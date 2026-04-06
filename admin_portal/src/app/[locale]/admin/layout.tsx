import { AdminProvider } from '@/components/providers/AdminProvider';
import OrderListener from '@/components/OrderListener';
import AdminHeader from '@/components/admin/AdminHeader';
import NumberInputAutoSelect from '@/components/ui/NumberInputAutoSelect';
import WorkspaceSelectorWrapper from '@/components/admin/WorkspaceSelectorWrapper';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
 return (
 <AdminProvider>
 <WorkspaceSelectorWrapper>
 <OrderListener />
 <AdminHeader />
 <NumberInputAutoSelect />
 {children}
 </WorkspaceSelectorWrapper>
 </AdminProvider>
 );
}
