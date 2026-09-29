import AskChat from '@/components/ask/AskChat';
import Navigation from '@/components/ui/Navigation';

export const metadata = {
  title: 'Ask (Virtual Me) - Virtual Brain',
};

export default function AskPage() {
  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] text-white overflow-hidden pb-[72px]">
      <div className="flex-1 overflow-hidden">
        <AskChat />
      </div>
      <Navigation />
    </div>
  );
}
