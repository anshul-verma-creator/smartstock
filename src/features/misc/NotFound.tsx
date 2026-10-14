import { ButtonLink, Empty } from '@/components/ui';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="panel mx-auto mt-10 max-w-lg">
      <Empty icon={<Compass size={22} />} title="Page not found" action={<ButtonLink to="/" variant="dark">Back to dashboard</ButtonLink>}>
        The link may be old, or the record was removed.
      </Empty>
    </div>
  );
}
