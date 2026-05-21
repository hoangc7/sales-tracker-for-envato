import { DashboardLayout } from '@/components/DashboardLayout';
import { ItemDetailPage } from '@/components/ItemDetailPage';

interface Props {
  params: Promise<{ envatoId: string }>;
}

export default async function ItemDetailRoute({ params }: Props) {
  const { envatoId } = await params;
  return (
    <DashboardLayout>
      <ItemDetailPage envatoId={envatoId} />
    </DashboardLayout>
  );
}
