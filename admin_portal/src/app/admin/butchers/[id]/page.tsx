"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
// Removing onAuthStateChanged import as it is no longer needed in this file
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  setDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  ref,
  getDownloadURL,
  uploadBytesResumable,
} from "firebase/storage";
import { MASTER_PRODUCTS, MasterProduct } from "@/lib/master_products";
import { auth, db, storage } from "@/lib/firebase";
import { Admin, ButcherPartner } from "@/types";
import { useAdmin } from "@/components/providers/AdminProvider";

import { Star, History } from "lucide-react";

// Local interface for meat orders
interface MeatOrder {
  id: string;
  butcherId: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  totalPrice?: number;
  status:
  | "pending"
  | "preparing"
  | "ready"
  | "delivered"
  | "completed"
  | "cancelled";
  createdAt?: { toDate: () => Date };
}

const planLabels: Record<string, { label: string; color: string }> = {
  ultra: {
    label: "MIRA Ultra",
    color: "bg-gradient-to-r from-purple-600 to-pink-600",
  },
  premium: { label: "MIRA Premium", color: "bg-purple-600" },
  standard: { label: "MIRA Standard", color: "bg-blue-600" },
  basic: { label: "MIRA Basic", color: "bg-gray-500" },
  free: { label: "MIRA Free", color: "bg-gray-700" },
  none: { label: "Yok", color: "bg-gray-800" },
};

// Add global declaration for Google Maps
declare global {
  interface Window {
    google: any;
  }
}

function parseTime(timeStr: string) {
  if (!timeStr) return null;

  // Normalize time string (remove AM/PM spaces to simplify)
  const normalized = timeStr.toUpperCase().replace(/\./g, ":");

  let hours = 0;
  let minutes = 0;

  // Handle AM/PM
  const isPM = normalized.includes("PM");
  const isAM = normalized.includes("AM");

  // Extract numbers
  const timeParts = normalized.match(/(\d+):?(\d+)?/);
  if (timeParts) {
    hours = parseInt(timeParts[1]);
    minutes = timeParts[2] ? parseInt(timeParts[2]) : 0;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
  }

  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}


// Helper to convert formatted time string (AM/PM) to 24h format (HH:MM)
function formatTo24h(timeStr: string): string {
  const dateObj = parseTime(timeStr);
  if (!dateObj) return timeStr; // Fallback if parse fails
  const h = dateObj.getHours().toString().padStart(2, '0');
  const m = dateObj.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function checkShopStatus(openingHours: string | string[]) {
  try {
    const hoursStr = Array.isArray(openingHours) ? openingHours.join("\n") : openingHours;
    if (!hoursStr) return { isOpen: false, text: "Kapalı", isClosed: true };

    const now = new Date();
    const dayNames = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
    const currentDay = dayNames[now.getDay()];

    const todayLine = hoursStr.split("\n").find(l =>
      l.startsWith(currentDay + ":") || l.startsWith(currentDay + " ")
    );

    if (!todayLine) return { isOpen: false, text: "Kapalı", isClosed: true };

    // Check for explicit "Kapalı" or "Closed"
    const lowerLine = todayLine.toLowerCase();
    if (lowerLine.includes("kapalı") || lowerLine.includes("closed")) {
      return { isOpen: false, text: "Bugün Kapalı", isClosed: true };
    }

    // Parse range "07:30 - 20:00" or "7:30 AM - 8:00 PM"
    const timePart = todayLine.split(": ").slice(1).join(": ").trim(); // Get everything after first colon
    if (!timePart) return { isOpen: false, text: "Saat Bilgisi Yok", isClosed: false };

    // Standardize split by "-" or "–" (en dash)
    const ranges = timePart.includes("–") ? timePart.split("–") : timePart.includes("-") ? timePart.split("-") : [];

    if (ranges.length < 2) return { isOpen: false, text: "Saat Formatı Hatalı", isClosed: false };

    const start = parseTime(ranges[0]);
    const end = parseTime(ranges[1]);

    if (!start || !end) return { isOpen: false, text: "Saat Parse Hatası" };

    if (now >= start && now <= end) {
      return { isOpen: true, text: "Şu An Açık" };
    } else {
      return { isOpen: false, text: "Şu An Kapalı" };
    }

  } catch (e) {
    console.error("Status checking error", e);
    return { isOpen: false, text: "Hata" };
  }
}

export default function ButcherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const butcherId = params.id as string;
  const initialTab = searchParams.get('tab') as 'overview' | 'orders' | 'products' | 'settings' || 'overview';

  const { admin, loading: adminLoading } = useAdmin();
  const [loading, setLoading] = useState(true); // Data loading state
  const [butcher, setButcher] = useState<ButcherPartner | null>(null);
  const [orders, setOrders] = useState<MeatOrder[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [activeTab, setActiveTab] = useState<
    "overview" | "orders" | "settings" | "products"
  >(initialTab);

  // Update tab when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'orders', 'products', 'settings'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);
  const [products, setProducts] = useState<any[]>([]);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [productMode, setProductMode] = useState<'standard' | 'custom'>('standard');
  const [selectedMasterId, setSelectedMasterId] = useState("");
  const [customProductForm, setCustomProductForm] = useState({
    name: "",
    price: "",
    unit: "kg",
    imageFile: null as File | null,
  });
  const [addingProduct, setAddingProduct] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Form state for editing
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    customerId: "",
    brand: "tuna" as "tuna" | "akdeniz_toros" | "independent",
    brandLabelActive: true,
    street: "",
    postalCode: "",
    city: "",
    country: "DE",
    shopPhone: "",
    shopEmail: "",
    openingHours: "",
    contactName: "",
    contactSurname: "",
    contactPhone: "",
    contactEmail: "",
    contactRole: "",
    hasDifferentBillingAddress: false,
    billingStreet: "",
    billingPostalCode: "",
    billingCity: "",
    billingCountry: "DE",
    subscriptionPlan: "basic" as
      | "basic"
      | "standard"
      | "premium"
      | "free"
      | "ultra"
      | "none",
    monthlyFee: 0,
    accountBalance: 0,
    notes: "",
    supportsDelivery: false,
    deliveryPostalCode: "",
    deliveryRadius: 5,
    minDeliveryOrder: 0,
    deliveryFee: 0,
    acceptsCardPayment: false,
    vatNumber: "",
    imageUrl: "",
    googlePlaceId: "",
    rating: 0,
    reviewCount: 0,
    reviews: [] as any[],
    bankIban: "",
    bankBic: "",
    bankAccountHolder: "",
    bankName: "",
  });

  // Sub-admin (işçi) management state
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffList, setStaffList] = useState<
    {
      id: string;
      displayName: string;
      email?: string;
      phoneNumber?: string;
      adminType: string;
      isActive?: boolean;
    }[]
  >([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [staffSearchResults, setStaffSearchResults] = useState<
    { id: string; displayName?: string; email?: string; phoneNumber?: string }[]
  >([]);
  const [staffSearchLoading, setStaffSearchLoading] = useState(false);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteCountryCode, setInviteCountryCode] = useState("+49");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [staffLoading, setStaffLoading] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: (selectedRole?: string) => void;
    confirmText?: string;
    confirmColor?: string;
    showRoleSelect?: boolean;
    currentRole?: string;
    staffId?: string;
    staffName?: string;
  }>({ show: false, title: "", message: "", onConfirm: () => { } });
  const [selectedNewRole, setSelectedNewRole] = useState("");

  // Load admin data - REMOVED (Handled by AdminProvider)

  // Check if admin is ready to load data
  useEffect(() => {
    if (admin && !adminLoading) {
      // We can trigger data loading here if needed, but the individual load functions are called in another useEffect
    }
  }, [admin, adminLoading]);

  // Load butcher data
  const loadButcher = useCallback(async () => {
    if (!butcherId) return;
    try {
      const butcherDoc = await getDoc(doc(db, "businesses", butcherId));
      if (butcherDoc.exists()) {
        const data = {
          id: butcherDoc.id,
          ...butcherDoc.data(),
        } as ButcherPartner;
        setButcher(data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = data as any;
        setFormData({
          companyName: d.companyName || "",
          customerId: d.customerId || "",
          brand: d.brand || "tuna",
          brandLabelActive: d.brandLabelActive !== false,
          street: d.address?.street || "",
          postalCode: d.address?.postalCode || "",
          city: d.address?.city || "",
          country: d.address?.country || "DE",
          shopPhone: d.shopPhone || "",
          shopEmail: d.shopEmail || "",
          openingHours: Array.isArray(d.openingHours)
            ? d.openingHours.join("\n")
            : d.openingHours || "",
          contactName: d.contactPerson?.name || "",
          contactSurname: d.contactPerson?.surname || "",
          contactPhone: d.contactPerson?.phone || "",
          contactEmail: d.contactPerson?.email || "",
          contactRole: d.contactPerson?.role || "",
          hasDifferentBillingAddress: d.hasDifferentBillingAddress || false,
          billingStreet: d.billingAddress?.street || "",
          billingPostalCode: d.billingAddress?.postalCode || "",
          billingCity: d.billingAddress?.city || "",
          billingCountry: d.billingAddress?.country || "DE",
          subscriptionPlan: d.subscriptionPlan || "basic",
          monthlyFee: d.monthlyFee || 0,
          accountBalance: d.accountBalance || 0,
          notes: d.notes || "",
          supportsDelivery: d.supportsDelivery || false,
          deliveryPostalCode: d.deliveryPostalCode || "",
          deliveryRadius: d.deliveryRadius || 5,
          minDeliveryOrder: d.minDeliveryOrder || 0,
          deliveryFee: d.deliveryFee || 0,
          acceptsCardPayment: d.acceptsCardPayment || false,
          vatNumber: d.vatNumber || "",
          imageUrl: d.imageUrl || "",
          googlePlaceId: d.googlePlaceId || "",
          rating: d.rating || 0,
          reviewCount: d.reviewCount || 0,
          reviews: d.reviews || [],
          bankIban: d.bankDetails?.iban || "",
          bankBic: d.bankDetails?.bic || "",
          bankAccountHolder: d.bankDetails?.accountHolder || "",
          bankName: d.bankDetails?.bankName || "",
        });
      }
    } catch (error) {
      console.error("Error loading butcher:", error);
    }
    setLoading(false);
  }, [butcherId]);

  // Load orders
  const loadOrders = useCallback(async () => {
    if (!butcherId) return;
    try {
      const ordersQuery = query(
        collection(db, "meat_orders"),
        where("butcherId", "==", butcherId),
        orderBy("createdAt", "desc"),
        limit(50),
      );
      const ordersSnap = await getDocs(ordersQuery);
      const ordersData = ordersSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as MeatOrder,
      );
      setOrders(ordersData);
    } catch (error) {
      console.error("Error loading orders:", error);
    }
  }, [butcherId]);

  // Load staff
  const loadStaff = useCallback(async () => {
    if (!butcherId) return;
    try {
      const staffQuery = query(
        collection(db, "admins"),
        where("butcherId", "==", butcherId),
      );
      const staffSnap = await getDocs(staffQuery);
      const staffData = staffSnap.docs.map((doc) => ({
        id: doc.id,
        displayName: doc.data().displayName || "İsimsiz",
        email: doc.data().email,
        phoneNumber: doc.data().phoneNumber,
        adminType: doc.data().adminType || "Personel",
        isActive: doc.data().isActive,
      }));
      setStaffList(staffData);
    } catch (error) {
      console.error("Error loading staff:", error);
    }
  }, [butcherId]);

  // Load products
  const loadProducts = useCallback(async () => {
    if (!butcherId) return;
    try {
      const productsQuery = collection(db, `businesses/${butcherId}/products`);
      const productsSnap = await getDocs(productsQuery);
      const prods = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(prods);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  }, [butcherId]);

  // Handle Delete Product
  const handleDeleteProduct = async (productId: string) => {
    if (!butcherId) return;
    if (!confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, `businesses/${butcherId}/products`, productId));
      showToast("Ürün silindi", "success");
      loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      showToast("Ürün silinirken hata oluştu", "error");
    }
  };

  // Toggle Product Active Status
  const toggleProductActive = async (productId: string, currentStatus: boolean) => {
    if (!butcherId) return;
    try {
      await updateDoc(doc(db, `businesses/${butcherId}/products`, productId), {
        isActive: !currentStatus,
        updatedAt: new Date(),
      });
      showToast(currentStatus ? "Ürün pasif yapıldı" : "Ürün aktif yapıldı", "success");
      loadProducts();
    } catch (error) {
      console.error("Error toggling product:", error);
      showToast("Ürün durumu değiştirilirken hata oluştu", "error");
    }
  };

  // Handle Add Product
  const handleAddProduct = async () => {
    if (!butcherId) return;
    setAddingProduct(true);
    try {
      const productData: Record<string, unknown> = {
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (productMode === 'standard' && selectedMasterId) {
        // Standard product from master list
        const masterProduct = MASTER_PRODUCTS.find(p => p.id === selectedMasterId);
        if (!masterProduct) throw new Error("Master product not found");

        productData.masterId = selectedMasterId;
        productData.name = masterProduct.name;
        productData.category = masterProduct.category;
        productData.unit = 'kg'; // Default unit
        productData.price = parseFloat(customProductForm.price) || 0;
        productData.isCustom = false;
      } else if (productMode === 'custom') {
        // Custom product
        productData.name = customProductForm.name;
        productData.price = parseFloat(customProductForm.price) || 0;
        productData.unit = customProductForm.unit || 'kg';
        productData.isCustom = true;
        productData.approvalStatus = 'pending';

        // Handle image upload if provided
        if (customProductForm.imageFile) {
          // TODO: Upload image to storage
          // For now, just skip image
        }
      }

      await addDoc(collection(db, `businesses/${butcherId}/products`), productData);
      showToast("Ürün eklendi!", "success");
      setProductModalOpen(false);
      setSelectedMasterId('');
      setCustomProductForm({ name: '', price: '', unit: 'kg', imageFile: null });
      loadProducts();
    } catch (error) {
      console.error("Error adding product:", error);
      showToast("Ürün eklenirken hata oluştu", "error");
    } finally {
      setAddingProduct(false);
    }
  };

  useEffect(() => {
    if (admin) {
      loadButcher();
      loadOrders();
      loadStaff();
      loadProducts(); // Load products when admin is ready
    }
  }, [admin, loadButcher, loadOrders, loadStaff, loadProducts]);

  // Handle Image Selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setFormData({ ...formData, imageUrl: previewUrl });
    }
  };

  // Fetch data (Photo + Opening Hours) from Google Places
  // Fetch data (Photo + Opening Hours) from Google Places - SERVER SIDE
  const fetchGoogleData = async () => {
    if (!formData.googlePlaceId) {
      alert("Hata: Google Place ID boş.");
      return;
    }

    setUploading(true);
    console.log(
      "Fetching Google Data from Server for:",
      formData.googlePlaceId,
    );

    try {
      const res = await fetch(
        `/api/admin/google-place?placeId=${formData.googlePlaceId}`,
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Sunucu hatası");
      }

      console.log("Server API Response:", data);

      let successMsg = "";
      let updates: any = {};

      // 1. OPENING HOURS
      if (data.openingHours) {
        let hoursList = Array.isArray(data.openingHours) ? data.openingHours : data.openingHours.split("\n");

        // --- STANDARDIZATION LOGIC (Mirroring Mobile App) ---
        const enToTr: Record<string, string> = {
          'Monday': 'Pazartesi', 'Tuesday': 'Salı', 'Wednesday': 'Çarşamba',
          'Thursday': 'Perşembe', 'Friday': 'Cuma', 'Saturday': 'Cumartesi', 'Sunday': 'Pazar'
        };

        hoursList = hoursList.map((line: string) => {
          let cleanLine = line.trim();

          // 1. Check for English Day Names and Translate
          for (const [eng, tr] of Object.entries(enToTr)) {
            if (cleanLine.startsWith(eng)) {
              cleanLine = cleanLine.replace(eng, tr);
              break;
            }
          }

          // 2. Normalize Time Format (12h AM/PM -> 24h)
          // Regex: 8:00 AM, 8:00 PM, 7 PM etc.
          cleanLine = cleanLine.replace(/(\d{1,2})(:(\d{2}))?\s*([AP]M)/gi, (match, hStr, _, mStr, period) => {
            let h = parseInt(hStr);
            const m = mStr ? parseInt(mStr) : 0;
            period = period.toUpperCase();

            if (period === 'PM' && h < 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;

            const hFormatted = h.toString().padStart(2, '0');
            const mFormatted = m.toString().padStart(2, '0');
            return `${hFormatted}:${mFormatted}`;
          });

          // 3. Normalize Separators
          cleanLine = cleanLine.replace(/–/g, '-').replace(/—/g, '-');

          // 4. Translate "Closed" -> "Kapalı"
          cleanLine = cleanLine.replace(/Closed/gi, 'Kapalı');

          return cleanLine;
        });
        // ----------------------------------------------------

        updates.openingHours = hoursList.join("\n");
        successMsg += "Saatler (Normalize Edildi), ";
      }

      // 2. PHONE
      if (data.shopPhone && !formData.shopPhone) {
        updates.shopPhone = data.shopPhone;
        successMsg += "Telefon, ";
      }

      // 2.5 RATINGS & REVIEWS
      if (data.rating) {
        updates.rating = data.rating;
        updates.reviewCount = data.userRatingsTotal || data.reviewCount; // Use userRatingsTotal if available
        if (data.reviews) {
          updates.reviews = data.reviews; // Save full reviews array
        }
        successMsg += "Puan ve Yorumlar, ";
      }

      // 3. PHOTO (Async Fetch Blob)
      if (data.photoUrl) {
        successMsg += "Fotoğraf";
        try {
          // Try to fetch blob for upload
          const response = await fetch(data.photoUrl);
          if (!response.ok) throw new Error("Image fetch failed");

          const blob = await response.blob();
          const file = new File([blob], "google_place_photo.jpg", {
            type: "image/jpeg",
          });

          setImageFile(file);
          const previewUrl = URL.createObjectURL(file);
          // Use functional update to ensure we have latest updates
          setFormData((prev) => ({
            ...prev,
            ...updates,
            imageUrl: previewUrl,
          }));
        } catch (fetchErr) {
          console.warn(
            "Photo fetch failed (CORS?), using direct URL:",
            fetchErr,
          );
          setFormData((prev) => ({
            ...prev,
            ...updates,
            imageUrl: data.photoUrl,
          }));
        }
      } else {
        setFormData((prev) => ({ ...prev, ...updates }));
      }

      if (successMsg) {
        showToast(`Başarılı: ${successMsg}`, "success");
      } else {
        showToast("Veri bulundu ama eksik (Foto/Saat yok).", "error");
      }
    } catch (error: any) {
      console.error("Fetch error:", error);
      alert(`Hata: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!butcher) return;
    setSaving(true);
    try {
      let downloadURL = formData.imageUrl;

      // Check if we are trying to save a Blob URL without a file (should not happen, but safety first)
      if (downloadURL.startsWith("blob:") && !imageFile) {
        console.warn(
          "Attempted to save Blob URL without file. Reverting to previous image.",
        );
        downloadURL = butcher.imageUrl || ""; // Revert to old image
      }

      // Upload image if selected
      if (imageFile) {
        setUploading(true);
        const fileExt = imageFile.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const safeButcherId = butcher.id || "unknown_butcher";
        const storageRef = ref(
          storage,
          `butcher_images/${safeButcherId}/${fileName}`,
        );

        // Use resumable upload for better debugging and progress
        const uploadTask = uploadBytesResumable(storageRef, imageFile);

        downloadURL = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress =
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              console.log("Upload is " + progress + "% done");
              if (progress % 20 < 5) {
                // Show toast sparingly
                showToast(`Yükleniyor: %${Math.round(progress)}`, "success");
              }
            },
            (error) => {
              console.error("Upload failed:", error);
              reject(error);
            },
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            },
          );
        });

        console.log("Image uploaded successfully:", downloadURL);
        setUploading(false);
      }

      const updatedData: Record<string, any> = {
        companyName: formData.companyName || "",
        customerId: formData.customerId || "",
        brand: formData.brand || "tuna",
        brandLabelActive: formData.brandLabelActive !== false,
        address: {
          street: formData.street || "",
          postalCode: formData.postalCode || "",
          city: formData.city || "",
          country: formData.country || "DE",
        },
        shopPhone: formData.shopPhone || "",
        shopEmail: formData.shopEmail || "",
        openingHours: formData.openingHours ? formData.openingHours.split("\n") : [],
        contactPerson: {
          name: formData.contactName || "",
          surname: formData.contactSurname || "",
          phone: formData.contactPhone || "",
          email: formData.contactEmail || "",
          role: formData.contactRole || "",
        },
        hasDifferentBillingAddress:
          formData.hasDifferentBillingAddress || false,
        subscriptionPlan: formData.subscriptionPlan || "basic",
        monthlyFee: Number(formData.monthlyFee) || 0,
        accountBalance: Number(formData.accountBalance) || 0,
        notes: formData.notes || "",
        supportsDelivery: formData.supportsDelivery || false,
        rating: formData.rating || 0,
        reviewCount: formData.reviewCount || 0,
        reviews: Array.isArray(formData.reviews) ? formData.reviews : [], // Ensure not undefined
        deliveryPostalCode: formData.deliveryPostalCode || "",
        deliveryRadius: Number(formData.deliveryRadius) || 0,
        minDeliveryOrder: Number(formData.minDeliveryOrder) || 0,
        deliveryFee: Number(formData.deliveryFee) || 0,
        acceptsCardPayment: formData.acceptsCardPayment || false,
        vatNumber: formData.vatNumber || "", // Added missing vatNumber
        imageUrl: downloadURL || "",
        googlePlaceId: formData.googlePlaceId || "",
        bankDetails: {
          iban: formData.bankIban || "",
          bic: formData.bankBic || "",
          accountHolder: formData.bankAccountHolder || "",
          bankName: formData.bankName || "",
        },
      };

      // Only add billingAddress if it's enabled, otherwise remove it using deleteField() or null
      if (formData.hasDifferentBillingAddress) {
        updatedData.billingAddress = {
          street: formData.billingStreet || "",
          postalCode: formData.billingPostalCode || "",
          city: formData.billingCity || "",
          country: formData.billingCountry || "DE",
        };
      } else {
        updatedData.billingAddress = null;
      }

      // Check for plan change to update history
      if (formData.subscriptionPlan !== butcher.subscriptionPlan) {
        const historyEntry = {
          plan: butcher.subscriptionPlan,
          startDate: butcher.subscriptionStartDate || new Date(), // Fallback if missing
          endDate: new Date(),
          reason: "admin_update",
          changedBy: admin?.email || "admin",
        };

        // Initialize history array if missing
        const currentHistory = butcher.subscriptionHistory || [];
        updatedData.subscriptionHistory = [...currentHistory, historyEntry];

        // Update start date for the new plan
        updatedData.subscriptionStartDate = new Date();
      }

      updatedData.updatedAt = new Date();

      await updateDoc(doc(db, "businesses", butcher.id), updatedData);

      // Update local state completely
      const newButcherState = { ...butcher, ...updatedData } as ButcherPartner;
      setButcher(newButcherState);
      setFormData((prev) => ({ ...prev, imageUrl: downloadURL })); // Crucial: Update formData with real URL

      setIsEditing(false);
      setImageFile(null); // Reset file
      showToast("Değişiklikler başarıyla kaydedildi!", "success");
    } catch (error: any) {
      console.error("Save error:", error);
      const errorMessage = error?.message || "Bilinmeyen bir hata.";
      // Show toast
      showToast(`Hata: ${errorMessage}`, "error");

      // Show detailed alert if it looks like a storage issue
      if (
        errorMessage.includes("storage") ||
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("permission")
      ) {
        alert(
          `Depolama Hatası: ${errorMessage}\n\nLütfen Firebase Konsolundan "Storage" bölümünün etkinleştirildiğinden ve kuralların doğru olduğundan emin olun.`,
        );
      }
      setUploading(false);
    }
    setSaving(false);
  };

  // Toggle active status
  const toggleActiveStatus = async () => {
    if (!butcher) return;
    const newStatus = !butcher.isActive;
    const action = newStatus ? "aktif" : "deaktif";

    setConfirmModal({
      show: true,
      title: newStatus ? "✅ Hesabı Aktif Et" : "🔴 Hesabı Deaktif Et",
      message: `Bu kasabı ${action} yapmak istediğinize emin misiniz?`,
      confirmText: newStatus ? "Aktif Et" : "Deaktif Et",
      confirmColor: newStatus
        ? "bg-green-600 hover:bg-green-500"
        : "bg-red-600 hover:bg-red-500",
      onConfirm: async () => {
        setSaving(true);
        try {
          await updateDoc(doc(db, "businesses", butcher.id), {
            isActive: newStatus,
            updatedAt: new Date(),
          });
          setButcher({ ...butcher, isActive: newStatus });
          showToast(`Kasap ${action} yapıldı.`, "success");
        } catch (error) {
          console.error("Toggle error:", error);
          showToast("Hata oluştu!", "error");
        }
        setSaving(false);
        setConfirmModal({ ...confirmModal, show: false });
      },
    });
  };

  // Invite staff via WhatsApp
  const handleInviteStaff = async () => {
    if (!invitePhone || invitePhone.length < 10) {
      showToast("Geçerli bir telefon numarası girin", "error");
      return;
    }
    if (!inviteFirstName.trim()) {
      showToast("İsim gerekli", "error");
      return;
    }
    setStaffLoading(true);
    try {
      const fullPhone = inviteCountryCode + invitePhone;
      const displayName =
        inviteFirstName + (inviteLastName ? " " + inviteLastName : "");
      const staffId = `staff_${Date.now()}`;

      // Create staff record
      await setDoc(doc(db, "admins", staffId), {
        phoneNumber: fullPhone,
        displayName: displayName,
        butcherId: butcherId,
        butcherName: butcher?.companyName,
        adminType: "Personel",
        isActive: false,
        tempPasswordRequired: true,
        createdBy: admin?.id,
        createdAt: new Date(),
      });

      // Send WhatsApp invitation
      const loginUrl = `https://miraportal.com/login?phone=${encodeURIComponent(fullPhone)}`;
      const message = `Merhaba ${inviteFirstName}! ${butcher?.companyName} tarafından MIRA Portal'a davet edildiniz. Giriş yapmak için: ${loginUrl}`;

      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: fullPhone, message }),
      });

      showToast(`${inviteFirstName} başarıyla davet edildi!`, "success");
      setInvitePhone("");
      setInviteFirstName("");
      setInviteLastName("");
      loadStaff();
    } catch (error) {
      console.error("Invite error:", error);
      showToast("Davet gönderilemedi", "error");
    }
    setStaffLoading(false);
  };

  if (adminLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!butcher) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
        <p className="text-4xl mb-4">🔍</p>
        <p>Kasap bulunamadı</p>
        <Link
          href="/admin/butchers"
          className="text-blue-400 hover:underline mt-4"
        >
          ← Kasap Listesi
        </Link>
      </div>
    );
  }

  const planInfo = planLabels[butcher.subscriptionPlan || "none"];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === "success" ? "bg-green-600" : "bg-red-600"} text-white`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin/butchers"
                className="text-gray-400 hover:text-white"
              >
                ← Geri
              </Link>
              {/* Business Image */}
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                {butcher.imageUrl ? (
                  <img
                    src={butcher.imageUrl}
                    alt={butcher.companyName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {butcher.companyName}
                </h1>
                <p className="text-gray-400 text-sm">
                  {butcher.address?.city}, {butcher.address?.country}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-sm ${planInfo.color} text-white`}
              >
                {planInfo.label}
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm ${butcher.isActive ? "bg-green-600" : "bg-red-600"} text-white`}
              >
                {butcher.isActive ? "✓ Aktif" : "✗ Pasif"}
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === "overview" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >
              Genel Bakış
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === "orders" ? "bg-red-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
            >
              Siparişler ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "settings" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-400 hover:text-gray-300"}`}
            >
              ⚙️ Ayarlar
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "products" ? "border-blue-500 text-blue-400" : "border-transparent text-gray-400 hover:text-gray-300"}`}
            >
              🥩 Ürünler
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-white font-bold mb-4">⚡ Hızlı İşlemler</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowStaffModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                >
                  👷 Personel Yönetimi
                </button>
                <button
                  onClick={toggleActiveStatus}
                  className={`px-4 py-2 rounded-lg text-white ${butcher.isActive ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"}`}
                >
                  {butcher.isActive ? "🔴 Deaktif Et" : "🟢 Aktif Et"}
                </button>
              </div>
            </div>

            {/* Active Staff & Couriers Panel */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">
                  👥 Aktif Personel & Kuryeler
                </h3>
                <span className="text-green-400 text-sm flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  {staffList.filter((s) => s.isActive !== false).length} Online
                </span>
              </div>

              {/* Online Staff Grid */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Mağaza Çalışanları */}
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-gray-300 text-sm font-medium mb-3 flex items-center gap-2">
                    🏪 Mağaza Çalışanları
                  </h4>
                  <div className="space-y-2">
                    {staffList.filter((s) => s.isActive !== false).length ===
                      0 ? (
                      <p className="text-gray-500 text-sm">
                        Henüz aktif personel yok
                      </p>
                    ) : (
                      staffList
                        .filter((s) => s.isActive !== false)
                        .map((staff) => (
                          <div
                            key={staff.id}
                            className="flex items-center justify-between bg-gray-600/50 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                              <span className="text-white text-sm">
                                {staff.displayName}
                              </span>
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${staff.adminType === "Kasap Admin" ? "bg-purple-600/50 text-purple-300" : "bg-blue-600/50 text-blue-300"}`}
                            >
                              {staff.adminType}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>

                {/* Aktif Kuryeler */}
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <h4 className="text-gray-300 text-sm font-medium mb-3 flex items-center gap-2">
                    🏍️ Kuryeler (Dağıtımda)
                  </h4>
                  <div className="space-y-2">
                    {/* Demo kurye bilgileri - gerçek veri yoksa */}
                    {orders.filter((o) => o.status === "delivered").length >
                      0 ? (
                      orders
                        .filter((o) => o.status === "delivered")
                        .slice(0, 3)
                        .map((order, idx) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between bg-orange-600/20 border border-orange-600/30 rounded-lg px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xl">🏍️</span>
                              <div>
                                <span className="text-white text-sm">
                                  Kurye {idx + 1}
                                </span>
                                <p className="text-orange-400 text-xs">
                                  #{order.orderNumber || order.id.slice(0, 6)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-orange-400 text-sm font-medium">
                                {(Math.random() * 5 + 1).toFixed(1)} km
                              </p>
                              <p className="text-gray-400 text-xs">
                                ~{Math.floor(Math.random() * 15 + 5)} dk ETA
                              </p>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-500 text-sm">
                          🏍️ Şu an dağıtımda kurye yok
                        </p>
                        <p className="text-gray-600 text-xs mt-1">
                          Teslimat başladığında burada görünecek
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Order Status Timeline */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold">
                  📊 Sipariş Durumları (Anlık)
                </h3>
                <span className="text-gray-400 text-sm">
                  Şu anki siparişler
                </span>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {/* Bekleyen - Yanıp söner */}
                <div
                  className={`flex-1 min-w-[100px] bg-yellow-600/20 border-2 border-yellow-500 rounded-lg p-4 text-center relative ${orders.filter((o) => o.status === "pending").length > 0 ? "animate-pulse" : ""}`}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-500 rounded-full border-2 border-gray-800"></div>
                  <p
                    className={`text-yellow-400 text-3xl font-bold ${orders.filter((o) => o.status === "pending").length > 0 ? "animate-bounce" : ""}`}
                  >
                    {orders.filter((o) => o.status === "pending").length}
                  </p>
                  <p className="text-yellow-300 text-sm font-medium">
                    🔔 Bekleyen
                  </p>
                </div>

                <div className="text-gray-500 text-xl">→</div>

                {/* Hazırlanıyor */}
                <div className="flex-1 min-w-[100px] bg-blue-600/20 border border-blue-600/30 rounded-lg p-4 text-center relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-gray-800"></div>
                  <p className="text-blue-400 text-3xl font-bold">
                    {orders.filter((o) => o.status === "preparing").length}
                  </p>
                  <p className="text-gray-400 text-sm">👨‍🍳 Hazırlanıyor</p>
                </div>

                <div className="text-gray-500 text-xl">→</div>

                {/* Hazır / Yolda */}
                <div className="flex-1 min-w-[100px] bg-purple-600/20 border border-purple-600/30 rounded-lg p-4 text-center relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-purple-500 rounded-full border-2 border-gray-800"></div>
                  <p className="text-purple-400 text-3xl font-bold">
                    {
                      orders.filter(
                        (o) => o.status === "ready" || o.status === "delivered",
                      ).length
                    }
                  </p>
                  <p className="text-gray-400 text-sm">🚚 Hazır/Yolda</p>
                </div>

                <div className="text-gray-500 text-xl">→</div>

                {/* Tamamlanan */}
                <div className="flex-1 min-w-[100px] bg-green-600/20 border border-green-600/30 rounded-lg p-4 text-center relative">
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                  <p className="text-green-400 text-3xl font-bold">
                    {orders.filter((o) => o.status === "completed").length}
                  </p>
                  <p className="text-gray-400 text-sm">✓ Tamamlanan</p>
                </div>
              </div>

              {/* Timeline line */}
              <div className="relative mt-2 h-1 bg-gradient-to-r from-yellow-500 via-blue-500 to-green-500 rounded-full opacity-50"></div>
            </div>

            {/* Revenue Summary */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-white font-bold mb-4">💰 Gelir Özeti</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-green-400 text-2xl font-bold">
                    €
                    {orders
                      .reduce((sum, o) => sum + (o.totalPrice || 0), 0)
                      .toFixed(2)}
                  </p>
                  <p className="text-gray-400 text-sm">Toplam Ciro</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-blue-400 text-2xl font-bold">
                    {orders.length}
                  </p>
                  <p className="text-gray-400 text-sm">Toplam Sipariş</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-purple-400 text-2xl font-bold">
                    €
                    {orders.length > 0
                      ? (
                        orders.reduce(
                          (sum, o) => sum + (o.totalPrice || 0),
                          0,
                        ) / orders.length
                      ).toFixed(2)
                      : "0"}
                  </p>
                  <p className="text-gray-400 text-sm">Ortalama Sipariş</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <p className="text-yellow-400 text-2xl font-bold">
                    {staffList.length}
                  </p>
                  <p className="text-gray-400 text-sm">Personel</p>
                </div>
              </div>
            </div>

            {/* Contact Info & Membership Details */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Contact Info */}
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-white font-bold mb-4">
                  📞 İletişim Bilgileri
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Yetkili Kişi</p>
                      <p className="text-white font-medium">
                        {butcher.contactPerson?.name
                          ? `${butcher.contactPerson.name} ${butcher.contactPerson.surname || ""}`
                          : "Belirtilmemiş"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {butcher.contactPerson?.role}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">İletişim</p>
                      <p className="text-white">
                        {butcher.contactPerson?.phone ||
                          butcher.shopPhone ||
                          "Belirtilmemiş"}
                      </p>
                      <p className="text-xs text-blue-400 truncate">
                        {butcher.contactPerson?.email ||
                          butcher.shopEmail ||
                          ""}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-gray-700 pt-3">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-gray-400 text-sm">Çalışma Saatleri</p>
                      {(() => {
                        const status = checkShopStatus(butcher.openingHours || "");
                        return (
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${status.isOpen
                              ? "bg-green-900/50 text-green-400 border border-green-800"
                              : "bg-red-900/50 text-red-400 border border-red-800"
                              }`}
                          >
                            {status.text}
                          </span>
                        );
                      })()}
                    </div>
                    {(() => {
                      const hoursData = butcher.openingHours;
                      const hoursList = Array.isArray(hoursData)
                        ? hoursData
                        : (hoursData || "").split("\n");

                      return hoursList.length > 0 && hoursList[0] !== "" ? (
                        <ul className="space-y-1">
                          {hoursList.map((line: string, i: number) => {
                            const today = new Date().toLocaleDateString("tr-TR", { weekday: "long" });
                            const dayName = line.split(":")[0]?.trim();
                            // Simple match check, can be improved if needed
                            const isToday = dayName === today || (today === "Pazar" && dayName === "Pazar");

                            return (
                              <li
                                key={i}
                                className={`text-xs flex justify-between px-2 py-1 rounded ${isToday
                                  ? "bg-green-900/20 text-green-300 font-medium border border-green-800/30"
                                  : "text-gray-300"
                                  }`}
                              >
                                <span className={isToday ? "text-green-400" : "font-medium text-gray-400"}>
                                  {line.split(": ")[0]}
                                </span>
                                <span>{line.split(": ")[1]}</span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <span className="text-xs text-gray-500 italic">
                          Bilgi yok
                        </span>
                      );
                    })()}
                  </div>
                  <div className="border-t border-gray-700 pt-3">
                    <p className="text-gray-400 text-sm">Adres</p>
                    <p className="text-white">
                      {butcher.address?.street}, {butcher.address?.postalCode}{" "}
                      {butcher.address?.city}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {butcher.address?.country}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subscription & Membership Status */}
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-white font-bold mb-4">
                  💳 Üyelik & Abonelik
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm">Mevcut Plan</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`w-3 h-3 rounded-full ${planInfo.color}`}
                        ></span>
                        <span className="text-white font-medium">
                          {planInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {butcher.monthlyFee > 0
                          ? `€${butcher.monthlyFee}/ay`
                          : "Ücretsiz"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Durum</p>
                      <span
                        className={`inline-block mt-1 px-2 py-1 rounded text-xs ${butcher.isActive ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}
                      >
                        {butcher.isActive ? "Aktif Müşteri" : "Pasif Müşteri"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-gray-700 pt-3">
                    <div>
                      <p className="text-gray-400 text-sm">Müşteri Tarihi</p>
                      <p className="text-white">
                        {(butcher as any).createdAt?.toDate
                          ? (butcher as any).createdAt
                            .toDate()
                            .toLocaleDateString("tr-TR")
                          : "Belirtilmemiş"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Plan Başlangıç</p>
                      <p className="text-white">
                        {(butcher.subscriptionStartDate as any)?.toDate
                          ? (butcher.subscriptionStartDate as any)
                            .toDate()
                            .toLocaleDateString("tr-TR")
                          : butcher.subscriptionStartDate
                            ? new Date(
                              butcher.subscriptionStartDate,
                            ).toLocaleDateString("tr-TR")
                            : "Belirtilmemiş"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-white font-bold text-xl">🥩 Ürün Kataloğu</h3>
                <p className="text-gray-400 text-sm">Kasap dükkanınızda sergilenen ürünler</p>
              </div>
              <button
                onClick={() => {
                  setProductModalOpen(true);
                  setProductMode('standard');
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 flex items-center gap-2"
              >
                <span className="text-lg">+</span> Ürün Ekle
              </button>
            </div>

            {/* Product List */}
            {products.length === 0 ? (
              <div className="py-12 text-center text-gray-500 border border-dashed border-gray-700 rounded-xl">
                <p className="text-4xl mb-2">🥩</p>
                <p>Henüz ürün eklenmemiş.</p>
                <button
                  onClick={() => setProductModalOpen(true)}
                  className="mt-4 text-blue-400 hover:underline"
                >
                  İlk ürününü ekle
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((prod) => (
                  <div key={prod.id} className="bg-gray-700/30 border border-gray-700 rounded-lg p-3 flex gap-3 relative group">
                    {/* Image */}
                    <div className="w-20 h-20 bg-gray-800 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {prod.isCustom && prod.imageUrl ? (
                        <img src={prod.imageUrl} className="w-full h-full object-cover" alt={prod.name} />
                      ) : (
                        // For standard products, show placeholder or name initial
                        <div className="text-2xl">🥩</div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="text-white font-medium truncate pr-6">{prod.name}</h4>
                      </div>
                      <p className="text-blue-400 font-bold mt-1">
                        €{prod.price} <span className="text-xs text-gray-500">/ {prod.unit}</span>
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${prod.isActive ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                          {prod.isActive ? "Aktif" : "Pasif"}
                        </span>
                        {prod.isCustom && (
                          <span className={`text-[10px] px-2 py-0.5 rounded ${prod.approvalStatus === 'approved' ? "bg-blue-900/50 text-blue-400" : "bg-yellow-900/50 text-yellow-400"}`}>
                            {prod.approvalStatus === 'approved' ? 'Onaylı' : 'Bekliyor'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDeleteProduct(prod.id)}
                        className="w-6 h-6 bg-red-600/20 text-red-400 rounded flex items-center justify-center hover:bg-red-600 hover:text-white"
                      >
                        🗑️
                      </button>
                      <button
                        onClick={() => toggleProductActive(prod.id, prod.isActive)}
                        className="w-6 h-6 bg-gray-600/20 text-gray-400 rounded flex items-center justify-center hover:bg-white hover:text-black"
                      >
                        👁️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ADD PRODUCT MODAL */}
        {productModalOpen && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl w-full max-w-lg overflow-hidden border border-gray-700">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="text-white font-bold">Ürün Ekle</h3>
                <button onClick={() => setProductModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-700">
                <button
                  onClick={() => setProductMode('standard')}
                  className={`flex-1 py-3 text-sm font-medium ${productMode === 'standard' ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-750"}`}
                >
                  🚀 Hızlı Seç (Standart)
                </button>
                <button
                  onClick={() => setProductMode('custom')}
                  className={`flex-1 py-3 text-sm font-medium ${productMode === 'custom' ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-750"}`}
                >
                  ✨ Özel Ürün (Talep)
                </button>
              </div>

              <div className="p-6">
                {productMode === 'standard' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Ürün Seçin</label>
                      <select
                        value={selectedMasterId}
                        onChange={(e) => {
                          setSelectedMasterId(e.target.value);
                          // Reset name/price if needed or keep user input? 
                          // Let's reset price field logic in real world, but keep simple
                        }}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                      >
                        <option value="">Seçiniz...</option>
                        {MASTER_PRODUCTS.map(mp => (
                          <option key={mp.id} value={mp.id}>
                            {mp.name} ({mp.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedMasterId && (
                      <div className="bg-blue-900/20 text-blue-300 p-3 rounded-lg text-sm">
                        <p>{MASTER_PRODUCTS.find(p => p.id === selectedMasterId)?.description}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Satış Fiyatı (€)</label>
                      <input
                        type="number"
                        value={customProductForm.price}
                        onChange={(e) => setCustomProductForm({ ...customProductForm, price: e.target.value })}
                        placeholder="0.00"
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Ürün Adı</label>
                      <input
                        type="text"
                        value={customProductForm.name}
                        onChange={(e) => setCustomProductForm({ ...customProductForm, name: e.target.value })}
                        placeholder="Örn: Özel Marine Köfte"
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-gray-400 text-sm block mb-1">Fiyat (€)</label>
                        <input
                          type="number"
                          value={customProductForm.price}
                          onChange={(e) => setCustomProductForm({ ...customProductForm, price: e.target.value })}
                          placeholder="0.00"
                          className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm block mb-1">Birim</label>
                        <select
                          value={customProductForm.unit}
                          onChange={(e) => setCustomProductForm({ ...customProductForm, unit: e.target.value })}
                          className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                        >
                          <option value="kg">Kg</option>
                          <option value="ad">Adet</option>
                          <option value="pk">Paket</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm block mb-1">Fotoğraf</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setCustomProductForm({ ...customProductForm, imageFile: e.target.files[0] });
                          }
                        }}
                        className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                      />
                    </div>
                    <div className="bg-yellow-900/20 text-yellow-500 p-3 rounded-lg text-xs">
                      ⚠️ Özel ürünler admin onayından sonra yayına girer.
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-750 flex justify-end gap-3">
                <button
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  İptal
                </button>
                <button
                  onClick={handleAddProduct}
                  disabled={addingProduct}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
                >
                  {addingProduct ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-white font-bold">Son Siparişler</h3>
              <Link
                href={`/admin/butchers/${butcher.id}/orders`}
                className="text-blue-400 hover:underline text-sm"
              >
                Tümünü Gör →
              </Link>
            </div>
            {orders.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-4">📦</p>
                <p>Henüz sipariş yok</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-gray-750 text-gray-400 text-sm">
                  <tr>
                    <th className="px-4 py-3">Sipariş No</th>
                    <th className="px-4 py-3">Müşteri</th>
                    <th className="px-4 py-3">Tutar</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Tarih</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {orders.slice(0, 10).map((order) => (
                    <tr
                      key={order.id}
                      className="border-t border-gray-700 hover:bg-gray-750"
                    >
                      <td className="px-4 py-3 font-mono text-sm text-blue-400">
                        {order.orderNumber || order.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <p>{order.customerName || "N/A"}</p>
                        <p className="text-xs text-gray-400">
                          {order.customerPhone}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        €{(order.totalPrice || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs ${order.status === "pending"
                            ? "bg-yellow-600"
                            : order.status === "preparing"
                              ? "bg-blue-600"
                              : order.status === "ready"
                                ? "bg-green-600"
                                : order.status === "delivered" ||
                                  order.status === "completed"
                                  ? "bg-gray-600"
                                  : order.status === "cancelled"
                                    ? "bg-red-600"
                                    : "bg-gray-700"
                            }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {order.createdAt
                          ?.toDate?.()
                          ?.toLocaleDateString("de-DE") || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white font-bold text-xl">
                ⚙️ Kasap Ayarları
              </h3>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
                >
                  ✏️ Düzenle
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50"
                  >
                    {saving ? "Kaydediliyor..." : "💾 Kaydet"}
                  </button>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Company Info */}
              <div className="space-y-4">
                <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                  🖼️ Görsel & Google (v2.0)
                </h4>

                {/* Image Upload & Google Fetch */}
                <div>
                  <label className="text-gray-400 text-sm block mb-1">
                    Kasap Görseli
                  </label>
                  <div className="flex items-start gap-4">
                    <div className="w-24 h-24 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center border border-gray-600 shrink-0 relative">
                      {formData.imageUrl ? (
                        <img
                          src={formData.imageUrl}
                          alt="Butcher"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl">🥩</span>
                      )}
                    </div>

                    {isEditing && (
                      <div className="flex flex-col gap-2 w-full">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="block w-full text-sm text-gray-400
                                                        file:mr-4 file:py-2 file:px-4
                                                        file:rounded-full file:border-0
                                                        file:text-sm file:font-semibold
                                                        file:bg-blue-600 file:text-white
                                                        hover:file:bg-blue-500
                                                        cursor-pointer"
                        />
                        <div className="flex items-center gap-2 my-1">
                          <span className="text-gray-600 text-xs">
                            - VEYA -
                          </span>
                        </div>

                        <button
                          onClick={fetchGoogleData}
                          disabled={!formData.googlePlaceId || uploading}
                          className="flex items-center justify-center px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                        >
                          {uploading && !imageFile ? (
                            <span className="animate-spin mr-2">⏳</span>
                          ) : (
                            <span className="mr-2">🪄</span>
                          )}
                          Google'dan Bilgileri Doldur (Server)
                        </button>
                        {!formData.googlePlaceId && (
                          <p className="text-xs text-red-400">
                            Google ID gerekli
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Google Place ID */}
                <div>
                  <label className="text-gray-400 text-sm">
                    Google Place ID (Değerlendirmeler için)
                  </label>
                  <input
                    type="text"
                    value={formData.googlePlaceId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        googlePlaceId: e.target.value,
                      })
                    }
                    disabled={!isEditing}
                    placeholder="ChIJ..."
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    <a
                      href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                      target="_blank"
                      className="text-blue-400 hover:underline"
                    >
                      Google Place ID Bulucu
                    </a>{" "}
                    kullanarak ID'yi bulun.
                  </p>
                </div>

                <h4 className="text-white font-medium border-b border-gray-700 pb-2 pt-4">
                  🏪 Şirket Bilgileri
                </h4>
                <div>
                  <label className="text-gray-400 text-sm">Şirket Adı</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                    disabled={!isEditing}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-sm">Müşteri No</label>
                  <input
                    type="text"
                    value={formData.customerId}
                    readOnly
                    disabled={true}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 opacity-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">🔒 Müşteri No değiştirilemez</p>
                </div>
                {/* Marka - Sadece Super Admin görebilir */}
                {admin?.adminType === 'super' && (
                  <div>
                    <label className="text-gray-400 text-sm">Marka</label>
                    <select
                      value={formData.brand}
                      onChange={(e) => {
                        const val = e.target.value as
                          | "tuna"
                          | "akdeniz_toros"
                          | "independent";
                        setFormData({
                          ...formData,
                          brand: val,
                          brandLabelActive: val !== "independent",
                        });
                      }}
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                    >
                      <option value="tuna">Tuna</option>
                      <option value="akdeniz_toros">Akdeniz Toros</option>
                      <option value="independent">Bağımsız</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <label className="text-gray-400 text-sm block mb-1">
                  Çalışma Saatleri
                </label>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  {isEditing ? (
                    <div className="space-y-2">
                      {[
                        { tr: "Pazartesi", en: "Monday" },
                        { tr: "Salı", en: "Tuesday" },
                        { tr: "Çarşamba", en: "Wednesday" },
                        { tr: "Perşembe", en: "Thursday" },
                        { tr: "Cuma", en: "Friday" },
                        { tr: "Cumartesi", en: "Saturday" },
                        { tr: "Pazar", en: "Sunday" },
                      ].map((dayObj) => {
                        // Extract time parts safely
                        // Expected format (internal): "Pazartesi: 08:00 - 18:00" OR "Pazartesi: Kapalı"
                        // Also handles Google format: "Monday: 8:00 AM – 6:00 PM"

                        const currentLine =
                          formData.openingHours
                            ?.split("\n")
                            .find(
                              (l) => {
                                // Strict match to support Pazar vs Pazartesi distinction
                                return l.startsWith(dayObj.tr + ":") || l.startsWith(dayObj.tr + " ") ||
                                  l.startsWith(dayObj.en + ":") || l.startsWith(dayObj.en + " ");
                              }
                            ) || "";

                        const isClosed = currentLine.toLowerCase().includes("kapalı") || currentLine.toLowerCase().includes("closed");

                        let startTime = "";
                        let endTime = "";

                        if (!isClosed && currentLine.includes(": ")) {
                          const timePart = currentLine.split(": ").slice(1).join(": ").trim();
                          // Handle en dash or hyphen
                          const separator = timePart.includes("–") ? "–" : "-";
                          const parts = timePart.split(separator).map(p => p.trim());

                          if (parts.length >= 2) {
                            // Convert to 24h format for display in input
                            const start24 = formatTo24h(parts[0]);
                            const end24 = formatTo24h(parts[1]);
                            startTime = start24;
                            endTime = end24;
                          }
                        }

                        // Helper to update specific day's hours
                        const updateHours = (newStart: string, newEnd: string, newClosed: boolean) => {
                          const newLines = [
                            "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar",
                          ].map((d) => {
                            // Find label for this day
                            const dObj = [
                              { tr: "Pazartesi", en: "Monday" },
                              { tr: "Salı", en: "Tuesday" },
                              { tr: "Çarşamba", en: "Wednesday" },
                              { tr: "Perşembe", en: "Thursday" },
                              { tr: "Cuma", en: "Friday" },
                              { tr: "Cumartesi", en: "Saturday" },
                              { tr: "Pazar", en: "Sunday" },
                            ].find((o) => o.tr === d);

                            const existingLine = formData.openingHours?.split("\n").find(
                              (l) => {
                                // Strict match: "Day:" or "Day " to avoid "Pazar" matching "Pazartesi"
                                const dayTR = dObj!.tr;
                                const dayEN = dObj!.en;
                                return l.startsWith(dayTR + ":") || l.startsWith(dayTR + " ") ||
                                  l.startsWith(dayEN + ":") || l.startsWith(dayEN + " ");
                              }
                            ) || "";

                            // If this is the day being updated
                            if (d === dayObj.tr) {
                              if (newClosed) return `${d}: Kapalı`;
                              return `${d}: ${newStart} - ${newEnd}`;
                            }

                            // Otherwise preserve existing logic (convert English to Turkish label if needed)
                            // If existing was English/Google format, we might want to normalize it too, but for now just keep as is or simple process
                            if (existingLine.startsWith(dObj!.en)) {
                              // It's in English (e.g. "Monday: ..."), convert label to Turkish
                              // Also we should ideally normalize the time to 24h here too if we want full consistency
                              const content = existingLine.split(": ").slice(1).join(": ");
                              return `${d}: ${content}`;
                            }

                            // Use existing line or default to closed if missing
                            return existingLine || `${d}: Kapalı`;
                          });

                          setFormData({
                            ...formData,
                            openingHours: newLines.join("\n"),
                          });
                        };

                        return (
                          <div
                            key={dayObj.tr}
                            className="flex items-center gap-3"
                          >
                            <span className="w-20 text-sm text-gray-400 font-medium">
                              {dayObj.tr}
                            </span>

                            {/* Start Time Input */}
                            <input
                              type="time"
                              value={formatTo24h(startTime)}
                              disabled={isClosed}
                              onChange={(e) => updateHours(e.target.value, endTime, false)}
                              className={`w-28 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`}
                            />

                            <span className="text-gray-500 font-bold">-</span>

                            {/* End Time Input */}
                            <input
                              type="time"
                              value={formatTo24h(endTime)}
                              disabled={isClosed}
                              onChange={(e) => updateHours(startTime, e.target.value, false)}
                              className={`w-28 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:border-blue-500 outline-none font-mono text-center [color-scheme:dark] ${isClosed ? 'opacity-30' : ''}`}
                            />

                            {/* Closed Checkbox */}
                            <label className="flex items-center cursor-pointer ml-auto">
                              <input
                                type="checkbox"
                                checked={isClosed}
                                onChange={(e) => updateHours(startTime, endTime, e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                              <span className="ml-2 text-xs text-gray-400 font-medium w-10">{isClosed ? "Kapalı" : "Açık"}</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  ) : formData.openingHours ? (
                    <ul className="space-y-1">
                      {formData.openingHours.split("\n").map((line, i) => (
                        <li
                          key={i}
                          className="text-xs text-gray-300 flex justify-between border-b border-gray-700/50 pb-1 last:border-0"
                        >
                          <span className="font-medium text-gray-400 w-24">
                            {line.split(": ")[0]}
                          </span>
                          <span className="font-mono">
                            {(() => {
                              const parts = line.split(": ");
                              const content = parts.length > 1 ? parts.slice(1).join(": ").trim() : "";
                              // Check for kapali or empty
                              if (content.toLowerCase().includes("kapalı") || content.toLowerCase().includes("closed")) return "Kapalı";
                              if (!content || content === "-" || content === "–") return "-";
                              return content;
                            })()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-gray-500 italic">
                      Bilgi yok
                    </span>
                  )}
                </div>
              </div>


              {/* MIRA Contact Person (New Section inside Company Info block) */}
              <div className="pt-4 mt-2 border-t border-gray-700">
                <h4 className="text-blue-400 font-medium text-sm mb-3">
                  👤 MIRA Yetkili İrtibat Kişisi
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">
                      Adı
                    </label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactName: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">
                      Soyadı
                    </label>
                    <input
                      type="text"
                      value={formData.contactSurname}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactSurname: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">
                      Kişisel Tel
                    </label>
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactPhone: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">
                      Kişisel Email
                    </label>
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          contactEmail: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div >

            <div className="space-y-6">
              <div className="space-y-6">
                {/* Address Info & Google Data */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                    📍 Adres & Google
                  </h4>
                  <div>
                    <label className="text-gray-400 text-sm">Sokak/Cadde</label>
                    <input
                      type="text"
                      value={formData.street}
                      onChange={(e) =>
                        setFormData({ ...formData, street: e.target.value })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-gray-400 text-sm">
                        Posta Kodu
                      </label>
                      <input
                        type="text"
                        value={formData.postalCode}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            postalCode: e.target.value,
                          })
                        }
                        disabled={!isEditing}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">Şehir</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) =>
                          setFormData({ ...formData, city: e.target.value })
                        }
                        disabled={!isEditing}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Google Place ID & Hours */}
                  <div className="pt-2">
                    <label className="text-gray-400 text-xs block mb-1">
                      Google Place ID
                    </label>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={formData.googlePlaceId || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            googlePlaceId: e.target.value,
                          })
                        }
                        disabled={!isEditing}
                        placeholder="ChIJ..."
                        className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      />
                      {isEditing && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            fetchGoogleData();
                          }}
                          disabled={uploading || !formData.googlePlaceId}
                          className="px-3 py-1.5 bg-blue-600/30 text-blue-300 text-xs rounded border border-blue-500/50 hover:bg-blue-600/50 transition-colors"
                        >
                          {uploading ? "..." : "Getir"}
                        </button>
                      )}
                    </div>


                  </div>
                </div>

                {/* Delivery Settings */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                    🚚 Teslimat Ayarları
                  </h4>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={formData.supportsDelivery}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          supportsDelivery: e.target.checked,
                        })
                      }
                      disabled={!isEditing}
                      className="w-5 h-5"
                    />
                    <span className="text-white">Kurye Desteği Var</span>
                  </div>
                  {formData.supportsDelivery && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-gray-400 text-sm">
                          Min. Sipariş (€)
                        </label>
                        <input
                          type="number"
                          value={formData.minDeliveryOrder}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              minDeliveryOrder: parseFloat(e.target.value) || 0,
                            })
                          }
                          disabled={!isEditing}
                          className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">
                          Teslimat Ücreti (€)
                        </label>
                        <input
                          type="number"
                          value={formData.deliveryFee}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              deliveryFee: parseFloat(e.target.value) || 0,
                            })
                          }
                          disabled={!isEditing}
                          className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Subscription */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                    💳 Abonelik
                  </h4>
                  <div>
                    <label className="text-gray-400 text-sm">Plan</label>
                    <select
                      value={formData.subscriptionPlan}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          subscriptionPlan: e.target.value as
                            | "basic"
                            | "standard"
                            | "premium"
                            | "free"
                            | "ultra"
                            | "none",
                        })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                    >
                      <option value="none">Yok</option>
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                      <option value="ultra">Ultra</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">
                      Aylık Ücret (€)
                    </label>
                    <input
                      type="number"
                      value={formData.monthlyFee}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          monthlyFee: parseFloat(e.target.value) || 0,
                        })
                      }
                      disabled={!isEditing}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Bank Details (SEPA) */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium border-b border-gray-700 pb-2">
                    🏦 Banka Bilgileri (SEPA)
                  </h4>
                  <div>
                    <label className="text-gray-400 text-sm">
                      Hesap Sahibi
                    </label>
                    <input
                      type="text"
                      value={formData.bankAccountHolder}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bankAccountHolder: e.target.value,
                        })
                      }
                      disabled={!isEditing}
                      placeholder="Örn: Ahmet Yılmaz"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Banka Adı</label>
                    <input
                      type="text"
                      value={formData.bankName}
                      onChange={(e) =>
                        setFormData({ ...formData, bankName: e.target.value })
                      }
                      disabled={!isEditing}
                      placeholder="Örn: Sparkasse"
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-gray-400 text-sm">IBAN</label>
                      <input
                        type="text"
                        value={formData.bankIban}
                        onChange={(e) =>
                          setFormData({ ...formData, bankIban: e.target.value })
                        }
                        disabled={!isEditing}
                        placeholder="DE..."
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">BIC</label>
                      <input
                        type="text"
                        value={formData.bankBic}
                        onChange={(e) =>
                          setFormData({ ...formData, bankBic: e.target.value })
                        }
                        disabled={!isEditing}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                {/* Reviews Section */}
                {formData.reviews && formData.reviews.length > 0 && (
                  <div className="pt-6 border-t border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500" />
                        <h3 className="font-semibold text-gray-200">
                          Google Yorumları
                        </h3>
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
                          {formData.rating?.toFixed(1)} ({formData.reviewCount})
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {formData.reviews
                        .slice(0, 3)
                        .map((review: any, i: number) => (
                          <div
                            key={i}
                            className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <img
                                src={review.profile_photo_url}
                                alt={review.author_name}
                                className="w-6 h-6 rounded-full"
                              />
                              <div className="flex-1 min-w-0">
                                <label htmlFor="brandLabelActive" className="text-sm font-medium text-gray-400">
                                  App
                                </label>
                                <div className="text-xs font-medium text-gray-300 truncate">
                                  {review.author_name}
                                </div>
                                <div className="flex text-yellow-500 text-[10px]">
                                  {"★".repeat(Math.round(review.rating))}
                                  <span className="text-gray-600 ml-1">
                                    {review.relative_time_description}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-3 italic">
                              "{review.text}"
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Subscription History */}
                {butcher && butcher.subscriptionHistory && butcher.subscriptionHistory.length > 0 && (
                  <div className="pt-6 border-t border-gray-700">
                    <div className="flex items-center gap-2 mb-4">
                      <History className="w-5 h-5 text-purple-400" />
                      <h3 className="font-semibold text-gray-200">Abonelik Geçmişi</h3>
                    </div>
                    <div className="overflow-x-auto bg-gray-800/30 rounded-lg border border-gray-700/50">
                      <table className="w-full text-xs text-left text-gray-400">
                        <thead className="text-gray-500 bg-gray-900/50 uppercase">
                          <tr>
                            <th className="px-4 py-2">Plan</th>
                            <th className="px-4 py-2">Başlangıç</th>
                            <th className="px-4 py-2">Bitiş</th>
                            <th className="px-4 py-2">Değiştiren</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {butcher.subscriptionHistory.map((h: any, i: number) => (
                            <tr key={i} className="hover:bg-gray-800/30">
                              <td className="px-4 py-2 font-medium text-white uppercase">{h.plan}</td>
                              <td className="px-4 py-2">{h.startDate?.seconds ? new Date(h.startDate.seconds * 1000).toLocaleDateString('tr-TR') : new Date(h.startDate).toLocaleDateString('tr-TR')}</td>
                              <td className="px-4 py-2">{h.endDate?.seconds ? new Date(h.endDate.seconds * 1000).toLocaleDateString('tr-TR') : new Date(h.endDate).toLocaleDateString('tr-TR')}</td>
                              <td className="px-4 py-2 text-gray-500">{h.changedBy?.split('@')[0]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div >
        )
        }
      </main >

      {/* Staff Management Modal */}
      {
        showStaffModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    👷 Personel Yönetimi
                  </h2>
                  <p className="text-gray-400 text-sm">{butcher?.companyName}</p>
                </div>
                <button
                  onClick={() => setShowStaffModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Current Staff */}
                <div>
                  <h3 className="text-white font-medium mb-3">
                    Mevcut Personel ({staffList.length})
                  </h3>
                  {staffList.length === 0 ? (
                    <p className="text-gray-400">Henüz personel yok</p>
                  ) : (
                    <div className="space-y-2">
                      {staffList.map((staff) => (
                        <div
                          key={staff.id}
                          className="bg-gray-700 rounded-lg p-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-white font-medium">
                              {staff.displayName}
                              {staff.isActive === false && (
                                <span className="text-red-400 text-sm ml-2">
                                  (Pasif)
                                </span>
                              )}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {staff.phoneNumber}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs ${staff.adminType === "Kasap Admin" ? "bg-purple-600" : "bg-blue-600"}`}
                          >
                            {staff.adminType}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Invite New Staff */}
                <div>
                  <h3 className="text-white font-medium mb-3">
                    Yeni Personel Ekle (WhatsApp Davet)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="İsim"
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                      className="bg-gray-700 text-white px-3 py-2 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Soyisim (opsiyonel)"
                      value={inviteLastName}
                      onChange={(e) => setInviteLastName(e.target.value)}
                      className="bg-gray-700 text-white px-3 py-2 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <select
                      value={inviteCountryCode}
                      onChange={(e) => setInviteCountryCode(e.target.value)}
                      className="bg-gray-700 text-white px-3 py-2 rounded-lg w-24"
                    >
                      <option value="+49">🇩🇪 +49</option>
                      <option value="+90">🇹🇷 +90</option>
                      <option value="+43">🇦🇹 +43</option>
                    </select>
                    <input
                      type="tel"
                      placeholder="Telefon numarası"
                      value={invitePhone}
                      onChange={(e) =>
                        setInvitePhone(e.target.value.replace(/\D/g, ""))
                      }
                      className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg"
                    />
                  </div>
                  <button
                    onClick={handleInviteStaff}
                    disabled={staffLoading}
                    className="w-full mt-3 bg-green-600 text-white py-3 rounded-lg hover:bg-green-500 disabled:opacity-50"
                  >
                    {staffLoading
                      ? "Gönderiliyor..."
                      : "📱 WhatsApp ile Davet Gönder"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Confirmation Modal */}
      {
        confirmModal.show && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-2xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-white mb-2">
                {confirmModal.title}
              </h3>
              <p className="text-gray-300 mb-6">{confirmModal.message}</p>

              {confirmModal.showRoleSelect && (
                <div className="mb-4">
                  <label className="text-gray-400 text-sm">Yeni Rol Seç</label>
                  <select
                    value={selectedNewRole}
                    onChange={(e) => setSelectedNewRole(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mt-1"
                  >
                    <option value="">-- Rol Seç --</option>
                    <option value="Kasap Admin">Kasap Admin</option>
                    <option value="Personel">Personel</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() =>
                    setConfirmModal({ ...confirmModal, show: false })
                  }
                  className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium"
                >
                  İptal
                </button>
                <button
                  onClick={() => confirmModal.onConfirm(selectedNewRole)}
                  className={`flex-1 px-4 py-3 text-white rounded-lg font-medium ${confirmModal.confirmColor || "bg-red-600 hover:bg-red-500"}`}
                >
                  {confirmModal.confirmText || "Onayla"}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
