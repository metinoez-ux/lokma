import { AdminProvider } from '@/components/providers/AdminProvider';
import OrderListener from '@/components/OrderListener';
import AdminHeader from '@/components/admin/AdminHeader';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminProvider>
            <OrderListener />
            <AdminHeader />
            {children}
        </AdminProvider>
    );
}
