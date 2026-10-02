import { Header } from '../components/layout/Header';
import { Hero } from '../components/hero/Hero';

export default function HomePage() {
  return (
    <div className="min-h-svh bg-white lg:p-5">
      <Header />
      <main>
        <Hero />
      </main>
    </div>
  );
}
