import AskChat from '@/components/ask/AskChat';
import Navigation from '@/components/ui/Navigation';

export const metadata = {
  title: 'Ask (Virtual Me) - Virtual Brain',
};

export default function AskPage() {
  return (
    <div className="flex flex-col h-screen bg-[#030308] text-white overflow-hidden pb-[80px] relative">
      {/* Ambient Atmospheric Lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-10 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex-1 overflow-hidden relative z-10">
        <AskChat />
      </div>
      <Navigation />
    </div>
  );
}
