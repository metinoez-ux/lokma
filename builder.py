import os

with open('admin_portal/src/app/[locale]/admin/business/[id]/page.tsx', 'r') as f:
    lines = f.readlines()

form_data = lines[342:442]
handle_save = lines[2076:2453]
ui = lines[3846:4583]

imports_block = """import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAdmin } from '@/components/providers/AdminProvider';
import { normalizeTimeString, getScheduleForToday } from '@/utils/timeUtils';
import MultiLanguageInput from '@/components/ui/MultiLanguageInput';
import LockedModuleOverlay from '@/components/admin/LockedModuleOverlay';
import { BUSINESS_TYPES } from '@/lib/business-types';
import { GERMAN_LEGAL_FORM_LABELS } from '@/types';

// Format utility
function formatTo24h(timeStr: string): string {
    return normalizeTimeString(timeStr) || timeStr;
}

export default function BusinessSettingsEditor({ 
    businessId, 
    business, 
    isAdminPanel = false,
    showToast,
    onSuccess 
}: {
    businessId: string;
    business?: any;
    isAdminPanel?: boolean;
    showToast: (msg: string, type: string) => void;
    onSuccess?: () => void;
}) {
    const t = useTranslations('AdminBusiness');
    const { admin } = useAdmin();
    
    // UI State
    const [isEditing, setIsEditing] = useState(!business);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [isletmeInternalTab, setIsletmeInternalTab] = useState<"bilgiler"|"fatura"|"zertifikalar"|"gorseller"|"saatler"|"teslimat">("bilgiler");
    const [saatlerSubTab, setSaatlerSubTab] = useState<"genel"|"kurye"|"gelal">("genel");
    const [settingsSubTab, setSettingsSubTab] = useState("isletme");
    const planFeatures = { delivery: true, pickup: true }; // Hardcode for now or pass as props if needed
"""

with open('admin_portal/src/components/admin/settings/BusinessSettingsEditor.tsx', 'w') as f:
    f.write(imports_block)
    f.writelines(form_data)
    
    # Initialize effect
    f.write("""
    useEffect(() => {
        if (business) {
            setFormData(prev => ({ ...prev, ...business }));
            setIsEditing(false);
        }
    }, [business]);
    """)

    f.writelines(handle_save)

    f.write("""
    return (
        <div className="space-y-6">
    """)
    f.writelines(ui)
    f.write("""
        </div>
    );
}
""")

print("Builder Done")
