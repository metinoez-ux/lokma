import { AdminProvider } from '@/components/providers/AdminProvider';
import OrderListener from '@/components/OrderListener';
import AdminHeader from '@/components/admin/AdminHeader';
import NumberInputAutoSelect from '@/components/ui/NumberInputAutoSelect';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <AdminProvider>
            <OrderListener />
            <AdminHeader />
            <NumberInputAutoSelect />
            {children}
        </AdminProvider>
    );
}
