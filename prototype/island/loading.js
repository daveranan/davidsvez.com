export function createSiteLoader(){
  const root=document.querySelector('.site-loader');
  const label=root?.querySelector('[data-loading-label]'),step=root?.querySelector('[data-loading-step]'),bar=root?.querySelector('.loader-progress');
  let finished=false,current=0;
  return {
    stage(number,text){if(!root||finished||number<current)return;current=number;label.textContent=text;step.textContent=`0${number} / 04`;bar.style.width=`${number*25}%`;},
    async finish(){
      if(!root||finished)return;finished=true;bar.style.width='100%';label.textContent='Ready';step.textContent='04 / 04';
      // Paint completion before revealing the already rendered scene.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      root.setAttribute('data-leaving','');
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>setTimeout(resolve,550));
      root.remove();
    },
  };
}
