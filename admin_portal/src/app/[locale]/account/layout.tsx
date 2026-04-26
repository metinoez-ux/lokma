import { AdminProvider } from '@/components/providers/AdminProvider';
import AdminHeader from '@/components/admin/AdminHeader';
import WorkspaceSelectorWrapper from '@/components/admin/WorkspaceSelectorWrapper';
import NumberInputAutoSelect from '@/components/ui/NumberInputAutoSelect';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
 return (
  <AdminProvider>
  <WorkspaceSelectorWrapper>
  <div className="min-h-screen flex flex-col bg-background">
    <AdminHeader />
    <NumberInputAutoSelect />
    <main className="flex-1 flex flex-col pt-0 pb-16">
      {children}
    </main>
    {process.env.NEXT_PUBLIC_BUILD_TIME && (
      <footer className="w-full text-center py-3 border-t border-border bg-card mt-auto transition-colors z-30">
        <p className="text-xs font-semibold text-rose-500/80">
          v.{process.env.NEXT_PUBLIC_BUILD_TIME} - LOKMA 2026 Admin Portal
        </p>
      </footer>
    )}
  </div>
  </WorkspaceSelectorWrapper>
  </AdminProvider>
 );
}
