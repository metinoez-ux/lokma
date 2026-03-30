import os

file_path = "/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/benutzerverwaltung/page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Chunk 1: State
state_target = """    // Edit Modal State
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editRoles, setEditRoles] = useState<string[]>([]);"""

state_replace = """    // Edit Modal State
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editRoles, setEditRoles] = useState<string[]>([]);
    
    // Additional Detailed Edit State
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editHouseNumber, setEditHouseNumber] = useState('');
    const [editAddressLine2, setEditAddressLine2] = useState('');
    const [editCity, setEditCity] = useState('');
    const [editPostalCode, setEditPostalCode] = useState('');
    const [editCountry, setEditCountry] = useState('Almanya');
    const [editRole, setEditRole] = useState('staff');
    const [editSector, setEditSector] = useState('');
    const [editBusinessId, setEditBusinessId] = useState('');"""

if state_target in content:
    content = content.replace(state_target, state_replace, 1)
else:
    print("Failed to find State Target")

# Chunk 2: handleEditUser
handle_target = """    const handleEditUser = async (user: UnifiedUser) => {
        // Prepare local stats
        setEditName(user.displayName || '');
        setEditPhone(user.phone || '');
        setEditRoles([...user.roles]);

        // Open local slide-over
        setSelectedUser(user);
        
        try {
            const adminDoc = await getDoc(doc(db, 'admins', user.id));
            if (adminDoc.exists()) {
                const data = adminDoc.data();
                setIsDriver(data.isDriver === true || (data.roles && data.roles.includes('driver')));
                setDriverType(data.driverType || 'platform');
                setSelectedBusinessIds(data.assignedBusinesses || []);
                setSelectedKermesIds(data.assignedKermes || []);
                setShowUserModal(true);
            } else {
                setIsDriver(user.roles.includes('driver'));
                setDriverType('platform');
                setSelectedBusinessIds([]);
                setSelectedKermesIds([]);
                setShowUserModal(true);
            }
        } catch (e) {
            console.error("Error fetching admin details", e);
            setIsDriver(user.roles.includes('driver'));
            setDriverType('platform');
            setSelectedBusinessIds([]);
            setSelectedKermesIds([]);
            setShowUserModal(true);
        }
    };"""

handle_replace = """    const handleEditUser = async (user: UnifiedUser) => {
        // Prepare local stats
        const namePart = user.displayName || '';
        const nameChunks = namePart.split(' ');
        
        setEditName(namePart);
        setEditPhone(user.phone || '');
        setEditRoles([...user.roles]);

        let pr = 'staff';
        if (user.roles.includes('super')) pr = 'super';
        else if (user.roles.includes('lokma_admin')) pr = 'lokma_admin';
        else if (user.roles.includes('business_admin')) pr = 'business_admin';
        else if (user.roles.includes('driver_business')) pr = 'driver_business';
        else if (user.roles.includes('driver_lokma')) pr = 'driver_lokma';
        
        setEditRole(pr);
        setSelectedUser(user);
        
        try {
            // First try fetching base user to extract address
            const userDoc = await getDoc(doc(db, 'users', user.id));
            if (userDoc.exists()) {
                const ud = userDoc.data();
                setEditFirstName(ud.firstName || nameChunks[0] || '');
                setEditLastName(ud.lastName || nameChunks.slice(1).join(' ') || '');
                setEditAddress(ud.addressDetails?.address || ud.address || '');
                setEditHouseNumber(ud.addressDetails?.houseNumber || ud.houseNumber || '');
                setEditAddressLine2(ud.addressDetails?.addressLine2 || ud.addressLine2 || '');
                setEditCity(ud.addressDetails?.city || ud.city || '');
                setEditPostalCode(ud.addressDetails?.postalCode || ud.postalCode || '');
                setEditCountry(ud.addressDetails?.country || ud.country || 'Almanya');
            } else {
                setEditFirstName(nameChunks[0] || '');
                setEditLastName(nameChunks.slice(1).join(' ') || '');
                setEditAddress('');
                setEditHouseNumber('');
                setEditAddressLine2('');
                setEditCity('');
                setEditPostalCode('');
                setEditCountry('Almanya');
            }

            const adminDoc = await getDoc(doc(db, 'admins', user.id));
            if (adminDoc.exists()) {
                const data = adminDoc.data();
                setIsDriver(data.isDriver === true || (data.roles && data.roles.includes('driver')) || false);
                setDriverType(data.driverType || 'platform');
                setSelectedBusinessIds(data.assignedBusinesses || []);
                setSelectedKermesIds(data.assignedKermes || []);
                setEditSector(data.sector || data.businessType || '');
                setEditBusinessId(data.businessId || data.butcherId || '');
            } else {
                setIsDriver(user.roles.includes('driver'));
                setDriverType('platform');
                setSelectedBusinessIds([]);
                setSelectedKermesIds([]);
                setEditSector('');
                setEditBusinessId('');
            }
        } catch (e) {
            console.error("Error fetching user details", e);
        }
        setShowUserModal(true);
    };"""

if handle_target in content:
    content = content.replace(handle_target, handle_replace, 1)
else:
    print("Failed to find handleEditUser target")

# Chunk 3: handleSaveUser
save_target = """    const handleSaveUser = async () => {
        if (!selectedUser) return;
        setSavingModal(true);
        try {
            // Let's decide if "driver" is in editRoles or not based on the checkbox
            let finalRoles = [...editRoles];
            if (isDriver && !finalRoles.includes('driver')) finalRoles.push('driver');
            if (!isDriver) finalRoles = finalRoles.filter(r => r !== 'driver');
            
            const assignedBusinessNames = businesses.filter(b => selectedBusinessIds.includes(b.id)).map(b => b.name);
            const assignedKermesNames = kermesEvents.filter(k => selectedKermesIds.includes(k.id)).map(k => k.name);
            
            const updatePayload = {
                name: editName,
                displayName: editName,
                phone: editPhone,
                roles: finalRoles,
                isDriver: isDriver,
                driverType: isDriver ? driverType : null,
                assignedBusinesses: isDriver ? selectedBusinessIds : [],
                assignedBusinessNames: isDriver ? assignedBusinessNames : [],
                assignedKermes: isDriver ? selectedKermesIds : [],
                assignedKermesNames: isDriver ? assignedKermesNames : [],
                updatedAt: Timestamp.now()
            };

            // Update Admins optionally
            if (finalRoles.length > 0 && !(finalRoles.length === 1 && finalRoles.includes('customer'))) {
                await updateDoc(doc(db, 'admins', selectedUser.id), updatePayload).catch(() => null);
            }
            
            // Update base User
            await updateDoc(doc(db, 'users', selectedUser.id), {
                name: editName,
                displayName: editName,
                phone: editPhone
            }).catch(() => null);

            // Update profile
            await updateDoc(doc(db, 'user_profiles', selectedUser.id), {
                name: editName,
                displayName: editName,
                phone: editPhone
            }).catch(() => null);

            setShowUserModal(false);
            fetchData(); // reload
        } catch (error) {
            console.error('Error updating user', error);
            alert("Fehler beim Speichern: " + (error as any).message);
        } finally {
            setSavingModal(false);
        }
    };"""

save_replace = """    const handleSaveUser = async () => {
        if (!selectedUser) return;
        setSavingModal(true);
        try {
            let finalRoles = [...editRoles];
            if (isDriver && !finalRoles.includes('driver')) finalRoles.push('driver');
            if (!isDriver) finalRoles = finalRoles.filter(r => r !== 'driver');
            
            const assignedBusinessNames = businesses.filter(b => selectedBusinessIds.includes(b.id)).map(b => b.name);
            const assignedKermesNames = kermesEvents.filter(k => selectedKermesIds.includes(k.id)).map(k => k.name);
            
            let currentAdminType = editRole !== 'customer' && editRole !== 'user' ? editRole : null;
            
            const updatePayload = {
                userId: selectedUser.id,
                email: selectedUser.email,
                firstName: editFirstName,
                lastName: editLastName,
                displayName: `${editFirstName} ${editLastName}`.trim() || editName,
                phoneNumber: editPhone,
                address: editAddress,
                houseNumber: editHouseNumber,
                addressLine2: editAddressLine2,
                postalCode: editPostalCode,
                city: editCity,
                country: editCountry,
                roles: finalRoles,
                isAdmin: currentAdminType !== null,
                adminType: currentAdminType,
                sector: editSector,
                butcherId: editBusinessId || undefined,
                butcherName: undefined as string | undefined, // Fixed by logic below
                isDriver: isDriver,
                driverType: isDriver ? driverType : null,
                assignedBusinesses: isDriver ? selectedBusinessIds : [],
                assignedBusinessNames: isDriver ? assignedBusinessNames : [],
                assignedKermes: isDriver ? selectedKermesIds : [],
                assignedKermesNames: isDriver ? assignedKermesNames : [],
                adminEmail: admin?.email
            };

            if (editBusinessId) {
                const b = businesses.find(bz => bz.id === editBusinessId);
                const k = kermesEvents.find(ke => ke.id === editBusinessId);
                if (b) updatePayload.butcherName = b.name;
                else if (k) updatePayload.butcherName = k.name;
            }

            const response = await fetch('/api/admin/update-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updateData: updatePayload })
            });

            if (!response.ok) {
                const data = await response.json();
                alert(`Hata: ${data.error || 'Bilinmeyen Hata'}`);
                setSavingModal(false);
                return;
            }

            setShowUserModal(false);
            fetchData(); // reload
        } catch (error) {
            console.error('Error updating user', error);
            alert("Fehler beim Speichern: " + String(error));
        } finally {
            setSavingModal(false);
        }
    };"""

if save_target in content:
    content = content.replace(save_target, save_replace, 1)
else:
    print("Failed to find handleSaveUser target")

# Chunk 4: Modal UI
ui_target = """                            {/* Profile Information Inputs */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-foreground">✍️ Temel Profil Bilgileri</h3>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Ad Soyad / Şirket Adı</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-pink-500"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Telefon Numarası</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-pink-500"
                                        value={editPhone}
                                        onChange={(e) => setEditPhone(e.target.value)}
                                        placeholder="+49..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">E-posta Adresi (Sadece Okunur)</label>
                                    <input 
                                        type="text" 
                                        readOnly
                                        disabled
                                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-muted-foreground opacity-70"
                                        value={selectedUser.email}
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">E-posta adresi giriş anahtarı olduğu için güvenlik amacıyla değiştirilemez.</p>
                                </div>
                            </div>"""

ui_replace = """                            {/* Personal Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">Kişisel Bilgiler</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">{t('adi') || 'Adı'} *</label>
                                        <input
                                            type="text"
                                            value={editFirstName}
                                            onChange={(e) => setEditFirstName(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">{t('soyadi') || 'Soyadı'} *</label>
                                        <input
                                            type="text"
                                            value={editLastName}
                                            onChange={(e) => setEditLastName(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('e_posta') || 'E-Posta'}</label>
                                    <input
                                        type="email"
                                        readOnly
                                        disabled
                                        value={selectedUser.email}
                                        className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-muted-foreground opacity-70"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1">E-posta adresi güvenlik nedeniyle değiştirilemez.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('telefon') || 'Telefon'}</label>
                                    <input
                                        type="tel"
                                        value={editPhone}
                                        onChange={(e) => setEditPhone(e.target.value)}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        placeholder="+49 177 1234567"
                                    />
                                </div>
                            </div>

                            <hr className="border-border" />

                            {/* Address Info */}
                            <div className="space-y-3">
                                <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">{t('adres_bilgileri') || 'Adres Bilgileri'}</h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('sokak') || 'Sokak'}</label>
                                        <input
                                            type="text"
                                            value={editAddress}
                                            onChange={(e) => setEditAddress(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('bina_no') || 'Bina No'}</label>
                                        <input
                                            type="text"
                                            value={editHouseNumber}
                                            onChange={(e) => setEditHouseNumber(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-foreground mb-1">{t('adres_satiri_2_daire_kat_vb') || 'Adres Satırı 2 (Daire, Kat vb.)'}</label>
                                    <input
                                        type="text"
                                        value={editAddressLine2}
                                        onChange={(e) => setEditAddressLine2(e.target.value)}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('posta_kodu') || 'Posta Kodu'}</label>
                                        <input
                                            type="text"
                                            value={editPostalCode}
                                            onChange={(e) => setEditPostalCode(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('sehir') || 'Şehir'}</label>
                                        <input
                                            type="text"
                                            value={editCity}
                                            onChange={(e) => setEditCity(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-foreground mb-1">{t('ulke') || 'Ülke'}</label>
                                        <input
                                            type="text"
                                            value={editCountry}
                                            onChange={(e) => setEditCountry(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <hr className="border-border" />

                            {/* Job Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm uppercase tracking-wider font-bold text-muted-foreground">{t('rol') || 'Yetki ve Bağlantılar'}</h3>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">{t('rol') || 'Rol'} *</label>
                                    <select
                                        value={editRole}
                                        onChange={(e) => { setEditRole(e.target.value); setEditSector(''); setEditBusinessId(''); }}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        disabled={!isSuperAdmin && editRole === 'super'}
                                    >
                                        {isSuperAdmin && <option value="super">{t('super_admin') || 'Super Admin'}</option>}
                                        <option value="staff">{t('personel') || 'Personel'}</option>
                                        <option value="business_admin">{t('i_sletme_admin') || 'İşletme Admin (Lokma/Kermes vb.)'}</option>
                                        <option value="driver_lokma">{t('lokma_filosu_surucusu') || 'Lokma Filosu Sürücüsü'}</option>
                                        <option value="driver_business">{t('i_sletme_surucusu') || 'İşletme Sürücüsü'}</option>
                                    </select>
                                </div>

                                {(editRole === 'staff' || editRole === 'business_admin') && isSuperAdmin && (
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">{t('sektor_modulu') || 'Sektör/Modül'}</label>
                                        <select
                                            value={editSector}
                                            onChange={(e) => setEditSector(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        >
                                            <option value="">{t('sektor_secin') || 'Sektör Seçin...'}</option>
                                            {getModuleBusinessTypes().map(bt => (
                                                <option key={bt.value} value={bt.value}>{bt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {(editRole === 'staff' || editRole === 'business_admin' || editRole === 'driver_business') && isSuperAdmin && (
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">{t('i_sletme_secin') || 'İşletme / Kermes Seçin'}</label>
                                        <select
                                            value={editBusinessId}
                                            onChange={(e) => setEditBusinessId(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                                        >
                                            <option value="">İşletme / Kermes Seçin...</option>
                                            {(editSector === 'kermes' ? kermesEvents : businesses)
                                                .filter(b => !editSector || editSector === 'kermes' || (b as any).type === editSector || (b as any).types?.includes(editSector))
                                                .map(b => (
                                                    <option key={b.id} value={b.id}>{b.name} {b.city ? `(${b.city})` : ''}</option>
                                                ))
                                            }
                                        </select>
                                    </div>
                                )}
                            </div>"""

if ui_target in content:
    content = content.replace(ui_target, ui_replace, 1)
else:
    print("Failed to find UI target")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Updated successfully!")
