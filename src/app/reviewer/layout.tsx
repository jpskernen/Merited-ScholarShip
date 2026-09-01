import DashboardLayout from '@/app/(main)/layout';

export default function ReviewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Leverage the existing main layout which handles sidebar and auth guards
  return <DashboardLayout>{children}</DashboardLayout>;
}