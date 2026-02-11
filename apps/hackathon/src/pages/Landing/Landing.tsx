import { Hero } from './sections/Hero';
import { Prizes } from './sections/Prizes';
import { About } from './sections/About';
import { HowToParticipate } from './sections/HowToParticipate';
import { FAQ } from './sections/FAQ';

export function Landing() {
  return (
    <>
      <Hero />
      <Prizes />
      <About />
      <HowToParticipate />
      <FAQ />
    </>
  );
}
