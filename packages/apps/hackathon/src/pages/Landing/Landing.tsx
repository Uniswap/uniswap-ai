import { Hero } from './sections/Hero';
import { About } from './sections/About';
import { Prizes } from './sections/Prizes';
import { HowToParticipate } from './sections/HowToParticipate';
import { FAQ } from './sections/FAQ';

export function Landing() {
  return (
    <>
      <Hero />
      <About />
      <Prizes />
      <HowToParticipate />
      <FAQ />
    </>
  );
}
