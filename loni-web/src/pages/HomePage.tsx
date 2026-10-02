import { motion } from 'framer-motion';
import { Header } from '../components/layout/Header';
import { Hero } from '../components/hero/Hero';

export default function HomePage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-svh bg-white lg:p-5"
    >
      <Header />
      <main>
        <Hero />
      </main>
    </motion.div>
  );
}
