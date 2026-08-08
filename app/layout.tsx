import './globals.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Autonomous AI Creator | ABTalks Hackathon PS3',
  description: 'Self-governing, 48h persistent AI persona discovering topics, applying editorial judgment, and publishing zero-human posts.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
