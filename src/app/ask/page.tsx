import AskChat from '@/components/ask/AskChat';

export const metadata = {
  title: 'Ask - Virtual Brain',
};

export default function AskPage() {
  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] text-white">
      <AskChat />
    </div>
  );
}
