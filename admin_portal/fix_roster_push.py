import re

file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesRosterTab.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

handle_search = r"""  const handleCreate = async \(e: React.FormEvent\) => \{.*?(?=  const handleDelete =)"""
handle_replace = """  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.userId || !form.role || !form.startDate || !form.endDate || !form.startTime || !form.endTime) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }
    
    // Yyyy-mm-dd string parsing logic that avoids timezone issues:
    const sParts = form.startDate.split('-');
    const eParts = form.endDate.split('-');
    const sDate = new Date(parseInt(sParts[0]), parseInt(sParts[1]) - 1, parseInt(sParts[2]), 12, 0, 0);
    const eDate = new Date(parseInt(eParts[0]), parseInt(eParts[1]) - 1, parseInt(eParts[2]), 12, 0, 0);

    if (sDate > eDate) {
      alert('Bitiş tarihi başlangıç tarihinden önce olamaz.');
      return;
    }

    setIsCreating(true);
    try {
      const datesToAssign: string[] = [];
      const current = new Date(sDate);
      while (current <= eDate) {
        datesToAssign.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }

      const newRosters: KermesRoster[] = [];
      for (const d of datesToAssign) {
        const payload = {
          kermesId,
          userId: form.userId,
          role: form.role,
          date: d,
          startTime: form.startTime,
          endTime: form.endTime,
          createdAt: Timestamp.now(),
          createdBy: adminUid
        };
        const docRef = await addDoc(collection(db, 'kermes_events', kermesId, 'rosters'), payload);
        newRosters.push({ id: docRef.id, ...payload } as KermesRoster);
      }
      
      // Optimistic update so it immediately appears in the list!
      setRosters(prev => [...prev, ...newRosters]);
      
      // Notify the user via Push and Email
      const staffMember = workspaceStaff.find(w => w.id === form.userId || w.userId === form.userId);
      const staffEmail = staffMember?.email;
      
      if (staffMember) {
        const isMultipleDays = datesToAssign.length > 1;
        const msgRange = isMultipleDays ? `${form.startDate} - ${form.endDate}` : form.startDate;
        const bodyMsg = `Kermes: ${msgRange} tarihlerinde, saat ${form.startTime}-${form.endTime} aralığında "${form.role}" görevi hesabınıza atanmıştır.`;
        
        // Push notification
        fetch('/api/admin/notify-staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: form.userId,
            title: `Kermeste Yeni Vardiya: ${form.role}`,
            body: bodyMsg,
            type: 'kermes_assignment'
          })
        }).catch(e => console.error('Push error:', e));
        
        // Email
        if (staffEmail) {
          fetch('/api/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: staffEmail,
              subject: 'Yeni Kermes Görevi / LOKMA Yönetim',
              html: `<div style="font-family:sans-serif;padding:24px;background:#f9fafb;"><h2 style="color:#1e40af;">Yeni Vardiya Bilgilendirmesi</h2><p>Merhaba ${staffMember.name || staffMember.displayName || 'Personel'},</p><p>Size yeni bir görev atanmıştır:</p><ul><li><strong>Rol:</strong> ${form.role}</li><li><strong>Tarih:</strong> ${msgRange}</li><li><strong>Saat:</strong> ${form.startTime} - ${form.endTime}</li></ul><p>İyi çalışmalar dileriz.</p></div>`
            })
          }).catch(e => console.error('Email error:', e));
        }
      }

      setForm(prev => ({ ...prev, userId: '', role: '' })); // Keep dates to easily assign next person
      setIsFullKermes(false);
    } catch (err) {
      console.error(err);
      alert('Kaydedilirken hata oluştu.');
    } finally {
      setIsCreating(false);
    }
  };

"""
content = re.sub(handle_search, handle_replace, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated handling code.')
