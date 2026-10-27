// Original portfolio dialogue informed by the user's previous-site wording and
// Lightkeeper's short, dry Yarn exchanges. No game dialogue is copied verbatim.
export const dialogueOpenings=[
  {greeting:"hey. how's it going?",lines:[['guide','just looking around?'],['you','yeah, for a bit.'],['guide','cool. take your time.']]},
  {greeting:'hey. over here.',lines:[['guide','find anything good yet?'],['you','still looking.'],['guide',"fair. there's a bit of everything."]]},
  {greeting:'hey. taking a break?',lines:[['guide','nice spot for a minute.'],['you','you here all day?'],['guide','more or less.']]},
  {greeting:'oh, hey.',lines:[['guide',"how's the walk?"],['you','pretty quiet.'],['guide','yeah. i like it here.']]},
  {greeting:'hey. want some company?',lines:[['guide','no rush, by the way.'],['you','good to know.'],['guide',"i'm not going anywhere."]]},
  {greeting:'hey. got a second?',lines:[['guide','you can ask me about the work.'],['you','or just hang out?'],['guide','yeah. that too.']]},
  {greeting:'hey. you found me.',lines:[['guide','i was about to take a break.'],['you','from what?'],['guide','standing here, mostly.']]},
  {greeting:'hey there.',lines:[['guide','making the rounds?'],['you',"seeing what's here."],['guide','nice. let me know if you need anything.']]},
  {greeting:'oh, hi.',lines:[['guide','want to sit for a bit?'],['you','maybe after a look around.'],['guide',"yeah. i'll be here."]]},
  {greeting:'hey. all good?',lines:[['guide',"there's no particular order to this."],['you','i can just wander?'],['guide','yeah. go for it.']]},
];

// Persist the remaining deck in this browser tab so reloads don't repeat an
// opening before the other nine have been used. Storage is optional.
export function createDialogueOpeningDeck({random=Math.random,readState=()=>null,writeState=()=>{}}={}){
  let remaining=[],previous=-1;
  try{const saved=readState();if(saved&&Number.isInteger(saved.previous)&&saved.previous>=0&&saved.previous<dialogueOpenings.length)previous=saved.previous;if(Array.isArray(saved?.remaining)&&new Set(saved.remaining).size===saved.remaining.length&&saved.remaining.every(id=>Number.isInteger(id)&&id>=0&&id<dialogueOpenings.length))remaining=saved.remaining.slice();}catch{}
  return{next(){
    if(!remaining.length){remaining=dialogueOpenings.map((_,id)=>id);for(let i=remaining.length-1;i>0;i--){const j=Math.min(i,Math.floor(random()*(i+1)));[remaining[i],remaining[j]]=[remaining[j],remaining[i]];}const last=remaining.length-1;if(remaining[last]===previous)[remaining[0],remaining[last]]=[remaining[last],remaining[0]];}
    previous=remaining.pop();try{writeState({remaining:remaining.slice(),previous});}catch{}return dialogueOpenings[previous];
  }};
}
export const worldConversation={
  'need-shovel':{title:'A thought',lines:[['you','oh I think I need a shovel for it']],choices:[['ask the bird',{action:'visit-shop'}],['leave it for now',{close:true}]]},
  about:{title:'Clearing guide',lines:dialogueOpenings[0].lines,choices:[['who’s dave?',{next:'dave'}],['show me his work',{next:'work'}],['got anything useful?',{next:'shop'}],['i’m just looking',{close:true}]]},
  dave:{title:'About Dave',lines:[['guide','this is dave speaking.'],['you','you’re a bird.'],['guide','right. well, he would be speaking if he was here.'],['guide','games, tools, films. sometimes a website escapes.']],choices:[['games?',{next:'games'}],['why all this?',{next:'why'}],['back',{next:'questions',back:true}]]},
  work:{title:'The work',lines:[['guide','the pages are real work. i am mostly overhead.'],['you','expensive overhead?'],['guide','i have two eyes and no skeleton budget.']],choices:[['product design',{next:'product'}],['games + development',{next:'games'}],['films + other work',{navigate:'archive'}],['back',{next:'questions',back:true}]]},
  games:{title:'Games',lines:[['guide','lightkeeper started as a game jam.'],['guide','then concept funding. then a playable vertical slice.'],['you','so it got bigger.'],['guide','yes. then smaller. that’s usually where the design happens.']],choices:[['show me lightkeeper',{navigate:'project/lightkeeper'}],['other games',{navigate:'games'}],['back',{next:'questions',back:true}]]},
  product:{title:'Product design',lines:[['guide','userwise. flax editor workflows. earthwallet.'],['guide','interfaces people actually have to use.'],['you','and this one?'],['guide','this one has a fishing rod. so. progress.']],choices:[['open product design',{navigate:'product'}],['back',{next:'questions',back:true}]]},
  why:{title:'Why',lines:[['guide','he says he works to manufacture joy.'],['you','industrial joy?'],['guide','small batch. occasionally unstable.'],['guide','his old site also promised there wouldn’t be a footer.']],choices:[['selected experience',{navigate:'resume'}],['one more thing',{next:'coffee'}],['back',{next:'questions',back:true}]]},
  coffee:{title:'The old website',lines:[['guide','his old site called coffee “the sweet nectar of early death”.'],['you','bit much.'],['guide','yes. best ask him about the work.']],choices:[['contact dave',{navigate:'contact'}],['back',{next:'questions',back:true}]]},
  sign:{title:'Directions',lines:[['sign','product design. game design. contact.'],['you','a talking sign.'],['sign','the bird was on a break.']],choices:[['product design',{navigate:'product'}],['game design',{navigate:'games'}],['contact',{navigate:'contact'}],['leave the sign alone',{close:true}]]},
  shop:{title:'Small business',lines:[['guide','i have practical skills. and a very small business.'],['you','you’re charging for a shovel?'],['guide','the website budget had to come from somewhere.']],shop:true,choices:[['back',{next:'questions',back:true}]]},
  'jump-learned':{title:'Jumping',lines:[['guide','you can jump now.'],['you','this wasn’t in the job description.'],['guide','tap a higher ledge up north. tap again in the air to glide.'],['guide','i’ll pretend that was onboarding.']],choices:[['show me lightkeeper’s traversal',{navigate:'project/lightkeeper'}],['got it',{close:true}]]},
};

worldConversation.questions={...worldConversation.about,lines:[['guide','what else?']]};

worldConversation['shop-more']={...worldConversation.shop,lines:[['guide','anything else?']]};
