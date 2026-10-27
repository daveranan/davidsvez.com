import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYTEST_BROWSER?{executablePath:process.env.PLAYTEST_BROWSER}:{}),args:['--use-angle=swiftshader','--enable-webgl']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  await page.goto(process.env.ISLAND_URL||'http://127.0.0.1:4175/island/');
  await page.waitForFunction(()=>window.fieldTrip?.getState().render&&fieldTrip.getState().intro===1);
  const result=await page.evaluate(async()=>{
    const samples=[];let last=performance.now();
    for(let i=0;i<75;i++)await new Promise(resolve=>requestAnimationFrame(time=>{if(i>14)samples.push(time-last);last=time;resolve();}));
    samples.sort((a,b)=>a-b);
    return{workload:'1600x1000 idle clearing, Chromium SwiftShader, 15 warm-up + 60 sampled frames',medianFrameMs:samples[Math.floor(samples.length/2)],p95FrameMs:samples[Math.floor(samples.length*.95)],...fieldTrip.getState().render};
  });
  await writeFile('prototype/island/.playtest/profile-final.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
