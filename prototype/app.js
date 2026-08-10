const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const initialSearchParams = new URL(window.location.href).searchParams;
const animationsDisabled = initialSearchParams.get("anim") === "off";
const bootDisabled = initialSearchParams.get("boot") === "off";
const appBasePath = window.location.pathname === "/site" || window.location.pathname.startsWith("/site/") ? "/site" : "";
const prefersReducedMotion = () => animationsDisabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (animationsDisabled) document.documentElement.dataset.anim = "off";

const state = {
  zIndex: 20,
  bootRun: 0,
  bootRenderer: null,
  projectRenderers: new Map(),
  projectOrigins: new WeakMap(),
  mediaLifecycles: new WeakMap(),
  projectTreeLifecycles: new WeakMap(),
  page: "home",
  viewTransitioning: false,
  viewTransitionToken: 0,
  secrets: {
    manifest: false,
    costco: false,
    costcoRequested: false,
    cheatCode: false,
    easterEgg: false,
  },
  backgroundAudio: {
    player: null,
    ready: false,
    requested: false,
    playing: false,
  },
  glyphNoise: {
    frame: 0,
    lastFrame: 0,
    running: false,
    paused: false,
    frameInterval: 92,
  },
  glyphCursor: {
    interactive: false,
    animating: false,
    animationToken: 0,
    fullscreenClose: false,
    actionLabel: "",
    transientToken: 0,
  },
  pointerGlitch: {
    x: -1000,
    y: -1000,
    previousX: -1000,
    previousY: -1000,
    previousTime: 0,
    lastMove: 0,
    lastFrame: 0,
    lastDrawFrame: 0,
    frameInterval: 1000 / 30,
    intensity: 0,
    running: false,
    samplePixels: null,
    sampleCanvas: null,
    sampleContext: null,
    sampleUpdatedAt: 0,
    sampleWidth: 160,
    sampleHeight: 90,
    trail: [],
    trailLifetime: 360,
  },
};

const fallbackProjectData = {
  signal: {
    title: "SIGNAL_STUDY.FOLDER",
    heading: "SIGNAL STUDY",
    kind: "VIDEO → ASCII → CONTENT",
    description:
      "A motion-led project preview. The color comes from the source frame; luminance chooses the glyph. The folder beneath remains ordinary HTML.",
    sourceType: "video",
    source: "assets/media/boot-preview.mp4",
    shortcutLabel: "SIGNAL.STUDY",
    role: "DESIGN / DEVELOPMENT",
    state: "PREVIEW COMPLETE",
    route: "/PROJECT/SIGNAL-STUDY",
    status: [
      "BRAIN HOPPING THE NETWORK",
      "DECODING VIDEO FRAME",
      "ASKING LUMA WHICH GLYPH IT WANTS",
      "EXPOSING GAME DESIGN",
    ],
  },
  still: {
    title: "STATIC_TRANSMISSION.FOLDER",
    heading: "STATIC TRANSMISSION",
    kind: "IMAGE → ASCII → CONTENT",
    description:
      "The same reveal accepts a still image when a project does not need video. Completed project imagery remains unfiltered inside the folder.",
    sourceType: "image",
    source: "assets/media/project-still.webp",
    shortcutLabel: "STATIC.TRANSMISSION",
    role: "DESIGN / DEVELOPMENT",
    state: "PREVIEW COMPLETE",
    route: "/PROJECT/STATIC-TRANSMISSION",
    status: [
      "REMEMBERING A SINGLE FRAME",
      "COUNTING COLORS THAT REFUSE TO MOVE",
      "TEACHING GLYPHS WHERE TO STAND",
      "OPENING THE STATIC FOLDER",
    ],
  },
};

let projectData = Object.fromEntries(
  Object.entries(fallbackProjectData).map(([id, project]) => [id, normalizeClientProject({ id, ...project })]),
);
let projectIndexData = projectData;
const projectPageCache = new Map();
const projectPageRequests = new Map();
const openingProjects = new Set();
let mediaData = {};
let blogData = [];
let contactData = {
  heading: "CONTACT",
  intro: "Tell me what you are making, breaking, or trying to understand.",
  availability: "AVAILABLE FOR SELECT PROJECTS",
  location: "OKLAHOMA / REMOTE",
};
let homepageData = {
  title: "INNER_CHILD_UNLOCKED.TXT",
  status: "04 PLACES / 28 PHOTOS",
  about: {
    name: "David Svezhintsev",
    intro: "I make games, tools, interfaces, films, and whatever else seems interesting enough to lose a few months to.",
    bio: "Born in Saint Petersburg, currently based in the US. I've spent most of my career around product design and production, and increasingly all of my time making games.",
    portrait: "assets/media/optimized/Photos/Me_1.jpg",
    photographyIntro: "I take a stupid amount of photos whenever I go anywhere.",
    photoGroups: [
      {
        location: "MUNICH / GERMANY",
        photos: [
          "assets/media/optimized/Photos/554040231_18531434125046765_8931794980576535083_n.jpg",
          "assets/media/optimized/Photos/554441068_18531434110046765_8000197146869765872_n.jpg",
          "assets/media/optimized/Photos/554673467_18531434191046765_4268393582935631706_n.jpg",
          "assets/media/optimized/Photos/556413253_18531434137046765_3455923459436891181_n.jpg",
        ],
      },
      {
        location: "ALPS / TRANSIT",
        photos: [
          "assets/media/optimized/Photos/566644297_18537455395046765_8582645022364281618_n.jpg",
          "assets/media/optimized/Photos/566685163_18537455350046765_5619875386881040422_n.jpg",
          "assets/media/optimized/Photos/566876842_18537455989046765_6113680450557617218_n.jpg",
          "assets/media/optimized/Photos/566903570_18537456001046765_6400845623940023593_n.jpg",
          "assets/media/optimized/Photos/569100069_18537456010046765_3390120784912870866_n.jpg",
        ],
      },
      {
        location: "LAKE COMO / ITALY / I",
        photos: [
          "assets/media/optimized/Photos/572122126_18539895181046765_5309456153486219621_n.jpg",
          "assets/media/optimized/Photos/572152224_18539725921046765_8630733899058429426_n.jpg",
          "assets/media/optimized/Photos/572224936_18539725930046765_1417773112285549974_n.jpg",
          "assets/media/optimized/Photos/572276184_18539895169046765_2511132439768510654_n.jpg",
          "assets/media/optimized/Photos/572521308_18539725912046765_3926527223070325396_n.jpg",
          "assets/media/optimized/Photos/572752102_18539895229046765_8420682720815155408_n.jpg",
          "assets/media/optimized/Photos/572759820_18539895157046765_24842795638625248_n.jpg",
          "assets/media/optimized/Photos/572767184_18539895190046765_5416876606842225061_n.jpg",
          "assets/media/optimized/Photos/572804333_18539895211046765_6677302748912053589_n.jpg",
          "assets/media/optimized/Photos/572891382_18539725939046765_7566299953536618752_n.jpg",
          "assets/media/optimized/Photos/574093629_18539895199046765_8543696088899625231_n.jpg",
        ],
      },
      {
        location: "LAKE COMO / ITALY / II",
        photos: [
          "assets/media/optimized/Photos/571981955_18543827299046765_4837020013419441924_n.jpg",
          "assets/media/optimized/Photos/582078962_18543827320046765_1908806272816245160_n.jpg",
          "assets/media/optimized/Photos/583339666_18543827362046765_6112675803669537357_n.jpg",
          "assets/media/optimized/Photos/584424905_18543827323046765_8607657616790426816_n.jpg",
          "assets/media/optimized/Photos/586929194_18543827353046765_9085698015355498495_n.jpg",
          "assets/media/optimized/Photos/587052368_18543827326046765_6514332653906332423_n.jpg",
          "assets/media/optimized/Photos/587284321_18543827344046765_8828664098831983175_n.jpg",
          "assets/media/optimized/Photos/587292956_18543827341046765_2284240041782548255_n.jpg",
        ],
      },
    ],
  },
  blocks: [
    {
      id: "character-test",
      type: "text",
      width: "full",
      heading: "DEPARTURE / ARRIVAL / 0123456789",
      body: "┌────────┬────────┐  ╔════════╗  +--------+\n│ GLYPHS ┼ ALIGN? │  ║ YES/NO ║  | ASCII  |\n└────────┴────────┘  ╚════════╝  +--------+",
      source: "",
      alt: "",
      fit: "cover",
    },
  ],
};

let transmissionData = {
  header: [
    "↗ HIIIIIIIIIIIIIIIIIIIIIIIIIIIIII THIS IS DAVE SPEAKING",
    "WELL, HE WOULD IF HE WAS HERE, SO I AM SPEAKING FOR HIM",
    "TREAT IT AS THE WORD OF DAVE, STRAIGHT FROM DAVE'S MOUTH, OR FINGERS",
    "LISTEN ANON, HAVE YOU QUESTIONED THE WHY LATELY?",
    "QUESTION THE WHY BEHIND THE WHY",
    "WHY DOES LOVE MATTER? WELL, THERE IS SEROTONIN IN YOUR BRAIN, DUH",
    "WHY DO YOU SEEK FRIENDSHIPS AT NIGHT?",
    "WHY DOES LONELINESS FEEL SO DAMN EXISTENTIAL?",
    "WHY CAN LOVE HURT YOU THE MOST?",
    "WHY ARE WE STILL HERE, JUST TO SUFFER?",
    "NOW THAT I THINK ABOUT IT, WHY ARE YOU STILL HERE ON MY SITE?",
    "WHY ARE ROSES BLUE? ARE THEY ACTUALLY BLUE?",
    "WHY DID IT HURT WHEN YOU USED ME THAT WAY?",
    "WHY IS LIFE SO BLAND AND BEAUTIFUL AT THE SAME TIME?",
    "KNOCK KNOCK. WHO IS THERE? YOUR MIND ASKING TO INSERT SOME DOPAMINE",
    "AND LET'S RUN THIS BAAAAAAAACK",
  ],
  ego: [
    "QUESTION REALITY",
    "SAID THE ANGRY FISH",
    "FLESH UNBOUND!!!",
    "MIND OVER MATTER",
    "ONE TRICK SONY PONY",
    "KICK THAT DOOR BABY",
    "LOBOTOMY WORLDS :P",
    "CREATIVITY > AI",
    "UNSHITIFY MY LIFE",
    "SATISFACTION > HEAVEN",
    "LOST AND FOUND HERE",
    "HOPE DIES LAST",
    "PUT CORTIZONE ON IT",
    "CREATIVITY UNBOUND",
    "HIDE IN THE CLOSET",
    "MORNING OUTSHINES",
    "BRING THE SICKNESS",
    "CRY ME A RIVER LOL",
    "PATIENT IS SCARED",
    "FORGET REMEMBRANCE",
  ],
  shadow: [
    "WHEREISMYMIND???",
    "WHEREISMYMIND???",
    "SICK, HERE IT IS",
    "YAYAYAYAYAYAYAYA",
    "DID YOU KNOW????",
    "YOU KNEW WHERE IT WAS? WTF BRO?",
    "FUNNYFUNNYFUNNY!",
    "SADSADSADSADSAD?",
    "HOPE DIES LAST",
    "PUT CORTIZONE ON IT",
    "CREATIVITY UNBOUND",
    "HIDE IN THE CLOSET",
    "MORNING OUTSHINES",
    "BRING THE SICKNESS",
    "CRY ME A RIVER LOL",
    "WELCOME TO COSTCO",
  ],
  typingSpeed: 65,
  commaPause: 300,
  sentencePause: 1000,
  phrasePause: 100,
};

function normalizeClientProject(project) {
  return {
    parentId: null,
    layout: "folder",
    windowWidth: "704px",
    windowHeight: "462px",
    textWidth: "62ch",
    body: "",
    showOverview: true,
    showFolderActions: true,
    blocks: [],
    thumbnail: "",
    thumbnailType: "image",
    category: "EXPERIMENT",
    period: "",
    status: [],
    ...project,
  };
}

function hydrateMediaReferences(project) {
  const resolved = { ...project };
  const sourceMedia = mediaData[resolved.mediaRef];
  const thumbnailMedia = mediaData[resolved.thumbnailMediaRef] || sourceMedia;
  if (sourceMedia) {
    resolved.source = sourceMedia.sourcePath || sourceMedia.externalUrl || resolved.source || "";
    resolved.posterFrame = sourceMedia.posterFrame || resolved.posterFrame || "";
    if (["image", "video", "vimeo"].includes(sourceMedia.type)) resolved.sourceType = sourceMedia.type;
  }
  if (thumbnailMedia && ["image", "video"].includes(thumbnailMedia.type)) {
    resolved.thumbnail = thumbnailMedia.sourcePath || resolved.thumbnail || "";
    resolved.thumbnailType = thumbnailMedia.type;
    resolved.posterFrame = thumbnailMedia.posterFrame || resolved.posterFrame || "";
  }
  resolved.blocks = (Array.isArray(resolved.blocks) ? resolved.blocks : []).map((block) => {
    const media = mediaData[block.mediaRef];
    if (!media) return block;
    return {
      ...block,
      type: ["image", "video", "youtube", "vimeo"].includes(media.type) ? media.type : block.type,
      source: media.sourcePath || media.externalUrl || block.source || "",
      alt: block.alt || media.alt || media.title || "",
      body: block.body || media.caption || media.credits || "",
      posterFrame: media.posterFrame || block.posterFrame || "",
    };
  });
  return normalizeClientProject(resolved);
}

const systemProjectData = {
  "site-reel": normalizeClientProject({
    id: "site-reel",
    parentId: "@system",
    layout: "media-fullscreen",
    title: "REEL.MP4",
    heading: "REEL",
    kind: "VIMEO / FULLSCREEN",
    description: "DAVIDSVEZ reel.",
    sourceType: "vimeo",
    source: "https://vimeo.com/1071233243?share=copy&fl=sv&fe=ci",
    shortcutLabel: "REEL",
    category: "FILM",
    status: [
      "OPENING REEL",
      "DECODING VIDEO FRAME",
      "ASKING LUMA WHICH GLYPH IT WANTS",
      "PLAYING SIGNAL",
    ],
  }),
  "wanderstar-archive": normalizeClientProject({
    id: "wanderstar-archive",
    parentId: "@system",
    layout: "folder",
    windowMode: "legacy-compact",
    windowWidth: "396px",
    windowHeight: "550px",
    title: "WANDERSTAR.DIR",
    heading: "WANDERSTAR UG",
    shortcutLabel: "WANDERSTAR.DIR",
    kind: "LEGACY / DIRECTORY",
    description: "A recovered fragment from the old site about manufacturing joy, entertainment, and games.",
    thumbnail: "assets/legacy/wanderstar.gif",
    thumbnailType: "image",
    sourceType: "image",
    source: "assets/legacy/wanderstar.gif",
    previewFit: "contain",
    category: "EASTER EGG",
    period: "OLD SITE",
    showOverview: false,
    showFolderActions: false,
    blocks: [
      {
        id: "wanderstar-signal",
        type: "image",
        width: "full",
        heading: "GAMES / WANDERSTAR UG",
        body: "I work to manufacture joy, entertainment. I derive great pleasure, meaning and passion from making games. I hope you understand.\n\nMe and my cofounder split the difference between creativity and technicality.\n\nwww.wanderstar.io",
        source: "assets/legacy/wanderstar.gif",
        alt: "Recovered WANDERSTAR animation from the previous site",
        fit: "contain",
      },
    ],
    status: ["MOUNTING OLD DOMAIN", "RECOVERING WANDERSTAR SIGNAL", "MANUFACTURING JOY", "OPENING WANDERSTAR.DIR"],
  }),
  "dolly-sheep": normalizeClientProject({
    id: "dolly-sheep",
    parentId: "@system",
    layout: "folder",
    windowMode: "legacy-compact",
    windowWidth: "396px",
    windowHeight: "550px",
    title: "DOLLY_THE_SHEEP.PNG",
    heading: "Have You Heard of Dolly the Sheep?",
    shortcutLabel: "DOLLY.SHEEP",
    kind: "LEGACY / IMAGE",
    description: "I am that sheep. Beeeeeeee.",
    thumbnail: "assets/legacy/dolly-sheep.png",
    thumbnailType: "image",
    sourceType: "image",
    source: "assets/legacy/dolly-sheep.png",
    previewFit: "contain",
    category: "EASTER EGG",
    period: "OLD SITE",
    showOverview: false,
    showFolderActions: false,
    blocks: [
      {
        id: "dolly",
        type: "image",
        width: "full",
        heading: "HAVE YOU SEEN THIS SHEEP?",
        body: "i am that sheep\nbeeeeeeee",
        source: "assets/legacy/dolly-sheep.png",
        alt: "High-contrast sheep from the previous site",
        fit: "contain",
      },
    ],
    status: ["CLONING OLD IMAGE", "COUNTING SHEEP", "RECOVERING DOLLY", "BEEEEEEEE"],
  }),
  "morning-routine": normalizeClientProject({
    id: "morning-routine",
    parentId: "@system",
    layout: "folder",
    windowMode: "legacy-morning",
    windowWidth: "704px",
    windowHeight: "550px",
    title: "MORNING_ROUTINE.TXT",
    heading: "Morning Routine",
    shortcutLabel: "MORNING.TXT",
    kind: "LEGACY / TEXT + IMAGE",
    description: "Cause you asked so nicely.",
    thumbnail: "assets/legacy/deep-fried-meaning.png",
    thumbnailType: "image",
    sourceType: "image",
    source: "assets/legacy/deep-fried-meaning.png",
    previewFit: "contain",
    category: "EASTER EGG",
    period: "OLD SITE",
    showOverview: false,
    showFolderActions: false,
    blocks: [
      {
        id: "routine",
        type: "routine",
        width: "full",
        heading: "MORNING ROUTINE",
        intro: "cause you asked so nicely:",
        lines: [
          { text: "02:15am - i sleep" },
          { text: "03:55am - i sleep" },
          { text: "04:30am - real shit" },
          { text: "08:15am - i dream of your mom" },
          { text: "09:10am - i sleep" },
          { text: "09:30am - i shower" },
          { text: "10:00am - oh hey how about coffee, that sweet nectar of early death" },
          {
            prefix: "10:15am - ",
            label: "froghorn.exe",
            suffix: ", jamming sesh, just chatting",
            projectId: "froghorn-player",
          },
          {
            prefix: "11:00am - ",
            label: "you gotta bring forth the power of the bellanus blade",
            suffix: ", (dj can you play back that sample please?)",
            projectId: "bellanus-player",
          },
        ],
      },
      {
        id: "microplastic-race",
        type: "image",
        width: "full",
        heading: "ANOTHER DETOUR AGAIN",
        body: "did you know, mice have a tendency to grow old, just like humans do? a few shots of microplastics in our face, and we won't withdraw from this microplastic race. splendidly so, nonsensically logical nonsense! please find love for yourself tonight xoxoxo",
        source: "assets/legacy/deep-fried-meaning.png",
        alt: "Deep-fried meaning image from the previous site",
        fit: "contain",
      },
    ],
    status: ["CHECKING CLOCK", "MORNING IN PROGRESS", "BREWING EARLY DEATH", "OPENING MORNING_ROUTINE.TXT"],
  }),
  "froghorn-player": normalizeClientProject({
    id: "froghorn-player",
    parentId: "morning-routine",
    layout: "folder",
    windowMode: "legacy-compact",
    windowWidth: "594px",
    windowHeight: "462px",
    title: "FROGHORN.EXE",
    heading: "FROGHORN.EXE",
    shortcutLabel: "FROGHORN.EXE",
    kind: "LEGACY / YOUTUBE SIGNAL",
    description: "Jamming sesh, just chatting.",
    icon: "video",
    sourceType: "image",
    source: "assets/legacy/deep-fried-meaning.png",
    category: "EASTER EGG",
    period: "OLD SITE",
    showOverview: false,
    blocks: [
      {
        id: "froghorn-video",
        type: "youtube",
        width: "full",
        heading: "FROGHORN.EXE / JAMMING SESH",
        body: "Recovered from the old morning routine.",
        source: "https://www.youtube.com/watch?v=1BwDECuA0zs",
        alt: "Froghorn video on YouTube",
      },
    ],
    status: ["TUNING HORN", "OPENING OLD TAB", "BUFFERING FROGHORN", "JAMMING"],
  }),
  "bellanus-player": normalizeClientProject({
    id: "bellanus-player",
    parentId: "morning-routine",
    layout: "folder",
    windowMode: "legacy-compact",
    windowWidth: "594px",
    windowHeight: "462px",
    title: "BELLANUS_BLADE.EXE",
    heading: "THE BELLANUS BLADE",
    shortcutLabel: "BELLANUS.BLADE",
    kind: "LEGACY / YOUTUBE SIGNAL",
    description: "Bring forth the power of the Bellanus blade.",
    icon: "video",
    sourceType: "image",
    source: "assets/legacy/deep-fried-meaning.png",
    category: "EASTER EGG",
    period: "OLD SITE",
    showOverview: false,
    blocks: [
      {
        id: "bellanus-video",
        type: "youtube",
        width: "full",
        heading: "BRING FORTH THE POWER",
        body: "Recovered from the old morning routine.",
        source: "https://www.youtube.com/watch?v=fck5xbodonc",
        alt: "Bellanus Blade video on YouTube",
      },
    ],
    status: ["LOCATING BLADE", "SUMMONING BELLANUS", "BUFFERING POWER", "BLADE READY"],
  }),
  "myth-manifest": normalizeClientProject({
    id: "myth-manifest",
    parentId: "@system",
    layout: "folder",
    title: "MYTH_MANIFEST.TXT",
    heading: "My Myth [Manifest]",
    shortcutLabel: "MANIFEST.TXT",
    kind: "LEGACY / TEXT",
    description: "One of a kind, just for you anon.",
    thumbnail: "assets/legacy/birdge.png",
    thumbnailType: "image",
    sourceType: "image",
    source: "assets/legacy/birdge.png",
    category: "EASTER EGG",
    period: "OLD SITE",
    showOverview: false,
    showFolderActions: false,
    blocks: [
      {
        id: "manifest-image",
        type: "image",
        width: "third",
        heading: "MYTH",
        body: "this was my myth [manifest], hope you liked it, it's one of a kind, just for you anon",
        source: "assets/legacy/birdge.png",
        alt: "Recovered fried bird image",
        fit: "contain",
      },
      {
        id: "manifest-text",
        type: "text",
        width: "two-thirds",
        heading: "MANIFEST",
        body: "любовь навсегда и никогда. навсегда-навсегда, и только для меня. ведь мы не хотим что-то для других, всё только для себя. всё делаем и учимся и упиваемся и убираемся и убиваемся об ебанную стенку из-за дня в день. живи, пиши, цветы дари нам всем. позвони бабушке, если есть. а если нету, то и суда нету, а у суда правды нету. всё равно умрём. какая разница, если сейчас или вчера.\n\nмы живём в страхе от того, что мысли друг друга прочесть не можем. сидим и гадаем: а он ли мой? а она ли моя? или есть другой? и покупает ли он ей её любимое мороженое.\n\nis this website mobile responsive? now it is, and thank you for asking xoxo",
        source: "",
        alt: "",
        fit: "cover",
      },
    ],
    status: ["PARSING MYTH", "QUESTIONING MANIFEST", "LOOKING FOR TRUTH IN COURT", "OPENING MYTH_MANIFEST.TXT"],
  }),
  "costco-outro": normalizeClientProject({
    id: "costco-outro",
    parentId: "@system",
    layout: "folder",
    title: "COSTCO.EXE",
    heading: "The End. Fin. Конец.",
    shortcutLabel: "COSTCO.EXE",
    kind: "LEGACY / OUTRO",
    description: "Welcome to Costco. I love you.",
    thumbnail: "assets/legacy/welcome-to-costco.png",
    thumbnailType: "image",
    sourceType: "image",
    source: "assets/legacy/welcome-to-costco.png",
    category: "EASTER EGG",
    period: "OLD SITE",
    showOverview: false,
    showFolderActions: false,
    blocks: [
      {
        id: "costco-image",
        type: "image",
        width: "third",
        heading: "WELCOME",
        body: "welcome to costco,\ni love you.",
        source: "assets/legacy/welcome-to-costco.png",
        alt: "Welcome to Costco image from the previous site",
        fit: "contain",
      },
      {
        id: "the-end",
        type: "text",
        width: "two-thirds",
        heading: "THE END",
        body: "the end. fin. конец. прям пиздец какой конец. i got tired making this; this was a one-shot website. took like four hours designing this, man. that's it. that's it folks. can you imagine I was procrastinating making my own site for five years? but whatever, man. that's it.\n\nthis ain't the droids you're looking for; move along. why are you still here? lol why are you reading this. stop it, it tickles. ouch. damn okay guy, little touchy there. wow, you don't know when to end. you're a relentless little rascal, did you know that?\n\ndid you also know that the way we're learning is through dopamine releases, hence why you still stuck in that abusive relationship is most likely because it's a learned behavior, as the brain tries to seek pleasure even in pain. yeah, that shit is fucked up.\n\nanyway this is the end of the site. there's no more seasons, no cliffhangers, no fucking footers. i hate footers. look at me, i'm a stupid-ass footer now. wow, is this contact info? fuck that shit, man. i hate designing sites. maybe i got burned out. fuck it. i'm fine with it. i'm just now experiencing this raw, unfiltered, unflattering, yet hauntingly beautiful existence.\n\nall of that for seven days instead of making meaningful impact. at least making you laugh—that'd be grand. just achieving that alone.\n\nso, in the end...\n\nwelcome to costco,\ni love you.",
        source: "",
        alt: "",
        fit: "cover",
      },
    ],
    status: ["LOOKING FOR THE END", "FINDING ANOTHER PARAGRAPH", "DISABLING NO-SCROLL", "WELCOME TO COSTCO"],
  }),
  "offscreen-easter-egg": normalizeClientProject({
    id: "offscreen-easter-egg",
    parentId: "@system",
    layout: "folder",
    title: "OFFSCREEN_EGG.RU",
    heading: "There's Nothing Here",
    shortcutLabel: "OFFSCREEN.EGG",
    kind: "LEGACY / HIDDEN FILE",
    description: "No seriously though, what's there? Oh, nothing. Maybe an easter egg.",
    thumbnail: "assets/legacy/russian-easter-egg.png",
    thumbnailType: "image",
    sourceType: "image",
    source: "assets/legacy/russian-easter-egg.png",
    category: "EASTER EGG",
    period: "OLD SITE",
    showOverview: false,
    showFolderActions: false,
    blocks: [
      {
        id: "egg",
        type: "image",
        width: "half",
        heading: "НУ ЛАДНО",
        body: "ну ладно, похуй, пусть будет тут easter egg. я использовал этот set of characters для дизайна сайта, а оказалось: просто моноспейс ебани и всё круто будет.\n\nпривет. люблю людей. люблю гавкать иногда. а вообще я очень милый. всем глубоко похуй на это всё, но мне похуй, что тебе похуй, поэтому продолжим.",
        source: "assets/legacy/russian-easter-egg.png",
        alt: "Russian meme hidden off-screen on the previous site",
        fit: "contain",
      },
      {
        id: "egg-letter",
        type: "text",
        width: "full",
        heading: "DAVID / 2025-04-02",
        body: "я всегда думал что выросту кем то. мне почти 30 на момент когда я это написал. Ну так, примерно 29.3 с хвостиком, еще до 30 время есть. и теперь я не думаю что я кем то вырасту. я есть тот кем я вырос. ты думала об этом? а я думал. Я думал что вот буду кем то крутым в 7 лет. в 16 мечтал о мега доме, где я могу с друзьями делать что хочу, специфично креативное, дать возможность креативным людям делать что они хотят. в 22 я все потерял, кроме денег я еще потерял и нервы, и 2 года своих лет которые я ничерта не помню из за дипрессии. просто все 600 дней дипрессии были как один. проснулся однажды в 25, смотрю на весы, набрал 55 кило. приахуел конечно, но еще не проснулся. потом меня один знакомый спас, вместе играли в колду, модерн варфейр. Классная игра была. я группу одну таскал, а они мне работу предолжили. я себя пофиксил, и мозгом занялся. сбросил 38 кило. еще чуть чуть осталось и можно начать встречаться с девушками. Прикинь?\n\nну да ладно. вот сижу теперь, наслаждаюсь простым существованием. задаю вопросы ПОЧЕМУ. а ПОЧЕМУ БЫ И НЕТ отвечает вселенная. А мне все еще интересно почему. А у вселенной нету целей то. Все является сигналом / ответом. Вот возьми животный мир. У них что, есть цели какие то? типа мы думаем что у них цель «выжить».\n\nнет, у них цели нету, есть только импульс «я голоден» и они идут искать еду. Это не цель, это ответная реакция. Вот и ты сидишь тут читаешь меня, этот текст чисто из души моей, потому что я тебя сюда отправил, и у тебя ответная реакция какая то. я даже не знаю какая. Может быть ты даже этот текст перевел на свой язык. Поздравляю. Надеюсь ты хороший человек, ответсвтенный, самопознательный. Если ты такой, круто. Поздравляю. Ты редкий. Если нет, то стань им. Прошу, стань им. не будь 95% людей которые думаю что они само-осознанны. Будь теми 10тью процентами что не думаю что они само-осознанные, но хотят быть.\n\nwelcome to costco\nя тебя люблю.",
        source: "",
        alt: "",
        fit: "cover",
      },
    ],
    status: ["LOOKING OFF SCREEN", "IGNORING EXPLICIT WARNING", "FINDING ONE EXTRA EGG", "OPENING OFFSCREEN_EGG.RU"],
  }),
};

const osWindowShortcuts = [
  { target: "ego", label: "EGO.EXE", icon: "blog" },
  { target: "shadow", label: "SHADOW.EXE", icon: "blog" },
  { target: "monitor", label: "ABOUT_ME/", icon: "blog" },
];

const osEasterEggOrder = [
  "wanderstar-archive",
  "dolly-sheep",
  "morning-routine",
  "myth-manifest",
  "costco-outro",
];

function projectConfig(projectId) {
  return projectPageCache.get(projectId) || projectIndexData[projectId] || systemProjectData[projectId];
}

function projectChildren(parentId = null) {
  const projects = Object.values(projectIndexData).filter((project) => project.hidden !== true);
  if (parentId !== null) {
    return projects.filter((project) => (project.parentId || null) === parentId);
  }

  const categoryIds = new Set(["prototypes", "game-jams", "apps", "client-work", "visual-lab"]);
  const rootProjects = projects.filter((project) => (project.parentId || null) === null);
  const featuredProjects = projects.filter((project) => project.showOnRoot === true);
  return [
    ...rootProjects.filter((project) => !categoryIds.has(project.id)),
    ...featuredProjects,
    ...rootProjects.filter((project) => categoryIds.has(project.id)),
  ];
}

function isArchiveContainer(project) {
  const labels = [project?.title, project?.heading, project?.shortcutLabel]
    .map((value) => String(value || "").trim().toUpperCase());
  return project?.layout === "folder" && labels.some((label) => label === "ARCHIVE" || label === "ARCHIVE.DIR");
}

function visibleProjectChildren(parentId = null) {
  return projectChildren(parentId).flatMap((project) => (
    isArchiveContainer(project) ? visibleProjectChildren(project.id) : [project]
  ));
}

function projectHasChildren(projectId) {
  return visibleProjectChildren(projectId).length > 0;
}

function fullscreenMediaSet(projectId) {
  const current = projectConfig(projectId);
  if (!current || current.layout !== "media-fullscreen" || !current.parentId) return current ? [current] : [];
  const siblings = projectChildren(current.parentId).filter((project) => project.layout === "media-fullscreen");
  return siblings.length ? siblings : [current];
}

function setDeferredMediaSource(element, source, poster = "") {
  if (!element || !source) return element;
  element.dataset.mediaSrc = source;
  if (poster) element.dataset.mediaPoster = poster;
  return element;
}

function attachDeferredMedia(element) {
  if (!element?.dataset.mediaSrc || element.dataset.mediaAttached === "true") return;
  element.dataset.mediaAttached = "true";
  if (element.dataset.mediaPoster && element instanceof HTMLVideoElement) {
    element.poster = element.dataset.mediaPoster;
  }
  element.src = element.dataset.mediaSrc;
  if (element instanceof HTMLVideoElement) {
    const playsOnHover = element.dataset.mediaPlayback === "hover";
    element.muted = true;
    element.defaultMuted = true;
    element.loop = true;
    element.autoplay = !playsOnHover;
    element.playsInline = true;
    element.controls = false;
    element.preload = playsOnHover ? "metadata" : "auto";
    element.load();
    if (!playsOnHover) element.play().catch(() => {});
  }
}

function detachDeferredMedia(element, { force = false } = {}) {
  if (!element) return;
  if (element instanceof HTMLVideoElement) element.pause();
  element.removeAttribute("src");
  element.removeAttribute("poster");
  if (element instanceof HTMLVideoElement) element.load();
  delete element.dataset.mediaAttached;
}

function installDeferredMedia(container, observerRoot = null) {
  if (!container) return;
  state.mediaLifecycles.get(container)?.observer?.disconnect();
  const elements = $$('[data-media-src]', container);
  if (!elements.length) return;
  if (!("IntersectionObserver" in window)) {
    elements.forEach(attachDeferredMedia);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) attachDeferredMedia(entry.target);
      else detachDeferredMedia(entry.target);
    });
  }, {
    root: observerRoot,
    rootMargin: container.id === "project-tree-list" ? "220px" : "600px",
    threshold: 0.01,
  });
  elements.forEach((element) => observer.observe(element));
  state.mediaLifecycles.set(container, { observer, elements });
}

function teardownDeferredMedia(container) {
  if (!container) return;
  state.mediaLifecycles.get(container)?.observer?.disconnect();
  state.mediaLifecycles.delete(container);
  $$('img, video, iframe', container).forEach((element) => detachDeferredMedia(element, { force: true }));
}

function createPixelIcon(name, className = "pixel-icon") {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", className);
  icon.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `assets/icons/hackernoon-pixel.svg#${name}`);
  icon.append(use);
  return icon;
}

function projectLabel(project) {
  return project.shortcutLabel || project.heading.replaceAll(" ", ".");
}

function createProjectVisual(project, variant = "tile") {
  if (project.thumbnail) {
    const thumbnail = document.createElement(project.thumbnailType === "video" ? "video" : "img");
    thumbnail.className = `project-thumbnail project-thumbnail--${variant}`;
    thumbnail.setAttribute("aria-hidden", "true");
    thumbnail.tabIndex = -1;
    setDeferredMediaSource(thumbnail, project.thumbnail, project.posterFrame || "");
    if (thumbnail instanceof HTMLVideoElement) {
      thumbnail.muted = true;
      thumbnail.loop = true;
      thumbnail.autoplay = true;
      thumbnail.playsInline = true;
      thumbnail.preload = "auto";
      thumbnail.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(thumbnail.duration) && thumbnail.duration > 0) {
          thumbnail.currentTime = Math.min(0.12, thumbnail.duration / 2);
        }
      }, { once: true });
    } else {
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      thumbnail.decoding = "async";
    }
    return thumbnail;
  }

  if (project.layout === "media-fullscreen" && project.source) {
    const media = document.createElement(project.sourceType === "video" ? "video" : "img");
    media.className = `project-thumbnail project-thumbnail--${variant}`;
    media.setAttribute("aria-hidden", "true");
    media.tabIndex = -1;
    setDeferredMediaSource(media, project.source, project.posterFrame || "");
    if (media instanceof HTMLVideoElement) {
      media.muted = true;
      media.loop = true;
      media.autoplay = true;
      media.playsInline = true;
      media.preload = "auto";
      media.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(media.duration) && media.duration > 0) {
          media.currentTime = Math.min(0.12, media.duration / 2);
        }
      }, { once: true });
    } else {
      media.alt = "";
      media.loading = "lazy";
      media.decoding = "async";
    }
    return media;
  }

  const visual = document.createElement("span");
  visual.className = `project-glyph project-glyph--${variant} project-pixel`;
  visual.setAttribute("aria-hidden", "true");
  const iconName = project.icon || (project.layout === "folder" || projectHasChildren(project.id)
    ? (projectHasChildren(project.id) ? "folder-open" : "folder")
    : project.layout === "text-window"
      ? "blog"
      : project.sourceType === "video"
        ? "video"
        : "image");
  visual.append(createPixelIcon(iconName));
  return visual;
}

function formatShortcutLabel(value, lineLength = 12) {
  const label = String(value || "").trim();
  if (label.length <= lineLength) return label;

  const breakCandidates = [".", "_", "-"]
    .map((separator) => label.lastIndexOf(separator, lineLength - 1) + 1)
    .filter((index) => index > 0);
  const breakAt = breakCandidates.length ? Math.max(...breakCandidates) : lineLength;
  const firstLine = label.slice(0, breakAt);
  const remainder = label.slice(breakAt);
  const secondLine = remainder.length > lineLength
    ? `${remainder.slice(0, lineLength - 1)}…`
    : remainder;
  return `${firstLine}\n${secondLine}`;
}

async function loadSiteContent() {
  try {
    const [siteResponse, indexResponse] = await Promise.all([
      fetch("content/site.json", { cache: "no-store" }),
      fetch("content/projects-index.json", { cache: "no-store" }),
    ]);
    if (!siteResponse.ok) throw new Error(`Content request failed: ${siteResponse.status}`);
    const content = await siteResponse.json();
    if (!indexResponse.ok) throw new Error(`Project index request failed: ${indexResponse.status}`);
    content.projects = await indexResponse.json();
    if (!Array.isArray(content.projects) || !content.projects.length) {
      throw new Error("Content must contain at least one project");
    }
    projectIndexData = Object.fromEntries(
      content.projects.map((project) => [project.id, hydrateMediaReferences(project)]),
    );
    projectData = projectIndexData;
    blogData = Array.isArray(content.blog) ? content.blog : [];
    contactData = { ...contactData, ...(content.contact || {}) };
    homepageData = {
      ...homepageData,
      ...(content.homepage || {}),
      blocks: Array.isArray(content.homepage?.blocks) ? content.homepage.blocks : homepageData.blocks,
    };
    if (content.transmissions) {
      transmissionData = {
        ...transmissionData,
        ...content.transmissions,
        header: Array.isArray(content.transmissions.header)
          ? content.transmissions.header.filter(Boolean)
          : transmissionData.header,
        ego: Array.isArray(content.transmissions.ego)
          ? content.transmissions.ego.filter(Boolean)
          : transmissionData.ego,
        shadow: Array.isArray(content.transmissions.shadow)
          ? content.transmissions.shadow.filter(Boolean)
          : transmissionData.shadow,
      };
    }
    if (content.site?.title) $("h1").textContent = content.site.title;
  } catch (error) {
    console.warn("Using embedded fallback project content.", error);
  }
}

async function loadProjectPage(projectId) {
  if (systemProjectData[projectId]) return systemProjectData[projectId];
  if (projectPageCache.has(projectId)) return projectPageCache.get(projectId);
  if (projectPageRequests.has(projectId)) return projectPageRequests.get(projectId);
  const request = fetch(`content/projects/${encodeURIComponent(projectId)}.json`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Project page request failed: ${response.status}`);
      const page = normalizeClientProject(await response.json());
      projectPageCache.set(projectId, page);
      return page;
    })
    .catch((error) => {
      console.warn(error);
      return projectIndexData[projectId] || null;
    })
    .finally(() => projectPageRequests.delete(projectId));
  projectPageRequests.set(projectId, request);
  return request;
}

function unloadProjectPage(projectId) {
  if (!systemProjectData[projectId]) projectPageCache.delete(projectId);
}

function setBackgroundAudioUi(mode = "idle") {
  const toggle = $("#signal-player-toggle");
  const icon = $("#signal-player-icon");
  const player = $("#system-status");
  if (!toggle || !icon) return;
  const playing = mode === "playing";
  const labels = {
    idle: "[▶]",
    loading: "[··]",
    playing: "[Ⅱ]",
    error: "[×]",
  };
  icon.textContent = labels[mode] || labels.idle;
  player?.classList.toggle("is-playing", playing);
  if (playing) player?.classList.add("has-started");
  toggle.setAttribute("aria-pressed", String(playing));
  toggle.setAttribute("aria-label", playing ? "Pause background music" : "Play background music");
  toggle.title = mode === "error"
    ? "YouTube player unavailable"
    : playing
      ? "Pause background music"
      : "Play background music";
}

function installBackgroundAudioPlayer() {
  const toggle = $("#signal-player-toggle");
  if (!toggle) return;
  const audio = state.backgroundAudio;

  const createPlayer = () => {
    if (audio.player || !window.YT?.Player) return;
    audio.player = new window.YT.Player("background-audio-player", {
      width: "200",
      height: "200",
      videoId: "Y0mFlukSXck",
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        loop: 1,
        playlist: "Y0mFlukSXck",
        playsinline: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          audio.ready = true;
          if (audio.requested) audio.player.playVideo();
          else setBackgroundAudioUi("idle");
        },
        onStateChange: (event) => {
          const playing = event.data === window.YT.PlayerState.PLAYING;
          const paused = event.data === window.YT.PlayerState.PAUSED;
          audio.playing = playing;
          if (playing) audio.requested = true;
          if (paused) audio.requested = false;
          if (playing) setBackgroundAudioUi("playing");
          else if (audio.requested) setBackgroundAudioUi("loading");
          else setBackgroundAudioUi("idle");
        },
        onError: () => {
          audio.ready = false;
          audio.requested = false;
          audio.playing = false;
          setBackgroundAudioUi("error");
        },
      },
    });
  };

  const loadPlayer = () => {
    if (window.YT?.Player) {
      createPlayer();
      return;
    }
    if (document.querySelector('script[data-youtube-player-api]')) return;
    const previousReadyHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReadyHandler === "function") previousReadyHandler();
      createPlayer();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.dataset.youtubePlayerApi = "";
    script.addEventListener("error", () => setBackgroundAudioUi("error"));
    document.head.append(script);
  };

  toggle.addEventListener("click", () => {
    if (audio.requested) {
      audio.requested = false;
      audio.player?.pauseVideo();
      setBackgroundAudioUi("idle");
      return;
    }
    audio.requested = true;
    setBackgroundAudioUi("loading");
    if (audio.ready) audio.player.playVideo();
    else loadPlayer();
  });
}

function renderProjectNavigation() {
  const projects = projectChildren(null);
  const index = $("#project-index-list");
  const tree = $("#project-tree-list");
  const shortcuts = $("#shortcut-rack");
  state.projectTreeLifecycles.get(tree)?.disconnect();
  state.projectTreeLifecycles.delete(tree);
  index.replaceChildren();
  tree.replaceChildren();
  shortcuts.replaceChildren();

  projects.forEach((project) => {
    const labelText = projectLabel(project);
    const row = document.createElement("button");
    row.className = "project-tile";
    row.type = "button";
    row.dataset.openProject = project.id;
    row.setAttribute("aria-label", `Open ${labelText}`);
    row.title = labelText;
    const tileIcon = createProjectVisual(project, "tile");
    const heading = document.createElement("strong");
    heading.className = "control-label";
    heading.textContent = formatShortcutLabel(labelText);
    const overlay = document.createElement("span");
    overlay.className = "project-tile__overlay";
    const overlayIcon = document.createElement("span");
    overlayIcon.className = "project-tile__folder project-pixel";
    overlayIcon.append(createPixelIcon(projectHasChildren(project.id) ? "folder-open" : "folder"));
    const overlayName = document.createElement("strong");
    overlayName.className = "project-tile__name control-label";
    overlayName.textContent = project.heading || labelText;
    const overlayMeta = document.createElement("small");
    overlayMeta.className = "project-tile__meta";
    overlayMeta.textContent = [project.category, project.period].filter(Boolean).join(" / ");
    overlay.append(overlayIcon, overlayName, overlayMeta);
    row.append(tileIcon, heading, overlay);
    if (tileIcon instanceof HTMLVideoElement) {
      const playThumbnail = () => {
        attachDeferredMedia(tileIcon);
        tileIcon.play().catch(() => {});
      };
      row.addEventListener("pointerenter", playThumbnail);
      row.addEventListener("focus", playThumbnail);
    }
    index.append(row);

    const shortcut = document.createElement("button");
    shortcut.className = "shortcut";
    shortcut.type = "button";
    shortcut.dataset.openProject = project.id;
    shortcut.setAttribute("aria-label", `Open ${labelText}`);
    shortcut.title = labelText;
    const icon = createProjectVisual(project, "shortcut");
    const label = document.createElement("span");
    label.className = "control-label";
    label.textContent = formatShortcutLabel(labelText);
    shortcut.append(icon, label);
    shortcuts.append(shortcut);
  });

  osWindowShortcuts.forEach((file) => {
    const shortcut = document.createElement("button");
    shortcut.className = "shortcut shortcut--os-file";
    shortcut.type = "button";
    shortcut.dataset.openOsWindow = file.target;
    shortcut.setAttribute("aria-label", `Open ${file.label}`);
    shortcut.title = file.label;
    const icon = document.createElement("span");
    icon.className = "project-pixel";
    icon.append(createPixelIcon(file.icon));
    const label = document.createElement("span");
    label.className = "control-label";
    label.textContent = formatShortcutLabel(file.label);
    shortcut.append(icon, label);
    shortcuts.append(shortcut);
  });

  osEasterEggOrder.forEach((projectId) => {
    const file = systemProjectData[projectId];
    if (!file) return;
    const shortcut = document.createElement("button");
    shortcut.className = "shortcut shortcut--os-file shortcut--easter-egg";
    shortcut.type = "button";
    if (projectId === "myth-manifest") {
      shortcut.dataset.revealManifest = "";
    } else if (projectId === "costco-outro") {
      shortcut.dataset.revealCostco = "";
    } else {
      shortcut.dataset.openProject = projectId;
    }
    shortcut.setAttribute("aria-label", `Open ${file.title}`);
    shortcut.title = file.title;
    const visual = createProjectVisual(file, "shortcut");
    const label = document.createElement("span");
    label.className = "control-label";
    label.textContent = formatShortcutLabel(file.shortcutLabel || file.title);
    shortcut.append(visual, label);
    shortcuts.append(shortcut);
  });

  renderProjectTree(tree);
  installDeferredMedia(index);
  installDeferredMedia(tree);
  installDeferredMedia(shortcuts);

  const count = $(".window--index .window__status");
  if (count) count.textContent = `${String(projects.length).padStart(2, "0")} ITEMS`;
}

function renderProjectTree(container) {
  const root = document.createElement("div");
  root.className = "project-tree__root";
  root.textContent = `PROJECT_INDEX.DIR / ${String(Object.keys(projectData).length).padStart(2, "0")} ITEMS`;
  container.append(root);

  const entries = [];
  const walk = (parentId = null, ancestorLast = []) => {
    const children = visibleProjectChildren(parentId);
    children.forEach((project, index) => {
      const isLast = index === children.length - 1;
      entries.push({ project, isLast, ancestorLast });
      walk(project.id, [...ancestorLast, isLast]);
    });
  };

  walk();

  const createRow = ({ project, isLast, ancestorLast }, animate = false) => {
    const labelText = projectLabel(project);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `project-tree__row${animate ? " project-tree__row--entering" : ""}`;
    if (animate) {
      row.addEventListener("animationend", () => row.classList.remove("project-tree__row--entering"), { once: true });
    }
    row.dataset.openProject = project.id;
    row.setAttribute("aria-label", `Open ${labelText}`);
    row.title = labelText;

    const branch = document.createElement("span");
    branch.className = "project-tree__branch";
    branch.setAttribute("aria-hidden", "true");
    branch.textContent = `${ancestorLast.map((last) => (last ? "   " : "│  ")).join("")}${isLast ? "└─" : "├─"}`;

    const visual = createProjectVisual(project, "tree");
    if (visual instanceof HTMLVideoElement) {
      visual.dataset.mediaPlayback = "hover";
      const playPreview = () => {
        attachDeferredMedia(visual);
        visual.play().catch(() => {});
      };
      const pausePreview = () => {
        visual.pause();
        if (Number.isFinite(visual.duration) && visual.duration > 0) {
          visual.currentTime = Math.min(0.12, visual.duration / 2);
        }
      };
      row.addEventListener("pointerenter", playPreview);
      row.addEventListener("focus", playPreview);
      row.addEventListener("pointerleave", pausePreview);
      row.addEventListener("blur", pausePreview);
    }
    const identity = document.createElement("span");
    identity.className = "project-tree__identity";
    const heading = document.createElement("strong");
    heading.className = "control-label";
    heading.textContent = project.heading;
    const description = document.createElement("small");
    description.textContent = project.description;
    identity.append(heading, description);

    const main = document.createElement("span");
    main.className = "project-tree__main";
    main.append(branch, visual, identity);

    const layout = document.createElement("span");
    layout.className = "project-tree__layout";
    const layoutIcon = project.layout === "folder"
      ? "folder"
      : project.sourceType === "video"
        ? "video"
        : "image";
    layout.append(
      createPixelIcon(layoutIcon, "pixel-icon pixel-icon--meta"),
      document.createTextNode(`${project.layout} / ${project.sourceType}`.toUpperCase()),
    );
    const category = document.createElement("span");
    category.className = "project-tree__category";
    category.textContent = project.category || "EXPERIMENT";
    row.append(main, layout, category);
    return row;
  };

  const sentinel = document.createElement("div");
  sentinel.className = "project-tree__sentinel";
  sentinel.setAttribute("aria-hidden", "true");
  let rendered = 0;
  let appending = false;

  const appendBatch = (size, animate = true) => {
    if (rendered >= entries.length) return;
    sentinel.remove();
    const fragment = document.createDocumentFragment();
    const media = [];
    const end = Math.min(rendered + size, entries.length);
    while (rendered < end) {
      const row = createRow(entries[rendered], animate);
      media.push(...$$('[data-media-src]', row));
      fragment.append(row);
      rendered += 1;
    }
    container.append(fragment);

    if (rendered < entries.length) {
      sentinel.textContent = `├─ ${String(entries.length - rendered).padStart(3, "0")} ITEMS BUFFERED`;
      container.append(sentinel);
    }

    if (animate && media.length) {
      const lifecycle = state.mediaLifecycles.get(container);
      if (lifecycle?.observer) {
        media.forEach((element) => lifecycle.observer.observe(element));
        lifecycle.elements.push(...media);
      } else if (!("IntersectionObserver" in window)) {
        media.forEach(attachDeferredMedia);
      } else {
        installDeferredMedia(container);
      }
    }
  };

  // The tree is still hidden in grid mode while navigation is built, so its
  // bounding box is not useful here. One viewport of rows naturally leaves
  // roughly five buffered entries below the list's persistent header.
  const initialCount = Math.max(10, Math.ceil(window.innerHeight / 55));
  appendBatch(initialCount, false);

  if (!("IntersectionObserver" in window)) {
    appendBatch(entries.length, false);
    return;
  }

  const observer = new IntersectionObserver((observations) => {
    if (appending || !observations.some((entry) => entry.isIntersecting)) return;
    appending = true;
    requestAnimationFrame(() => {
      appendBatch(5);
      appending = false;
      if (rendered >= entries.length) observer.disconnect();
    });
  }, { rootMargin: "0px 0px 220px 0px", threshold: 0.01 });
  observer.observe(sentinel);
  state.projectTreeLifecycles.set(container, observer);
}

function hash2d(x, y, seed = 0) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

function renderGlyphBar(value, width = 24) {
  const phases = [" ", "░", "▒", "▓", "█"];
  const progress = clamp(value) * width;
  const cells = Array.from({ length: width }, (_, index) => {
    const cellProgress = clamp(progress - index);
    const phase = cellProgress === 0 ? 0 : Math.ceil(cellProgress * (phases.length - 1));
    return phases[phase];
  });
  return `[${cells.join("")}]`;
}

const scrambleSelector = [
  "h1",
  "h2",
  "h3",
  ".prose p",
  ".scroll-log p",
  ".specimen > p",
  ".media-buffer p",
  ".window__titlebar > span",
  ".file-row span",
  ".file-row strong",
  ".project-tile span",
  ".project-tile strong",
  ".child-project span",
  ".child-project strong",
  ".project-tree__root",
  ".project-tree__branch",
  ".project-tree__layout",
  ".project-tree__category",
  ".project-tree__row strong",
  ".project-tree__row small",
  ".site-nav .control-label",
  ".site-nav .view-row__controls > span",
  ".shortcut span:last-child",
  ".site-footer span",
  ".boot-panel__title",
  ".boot-panel__label",
  ".glyph-progress",
  ".project-folder p",
  ".project-folder dt",
  ".project-folder dd",
  ".text-layout__body",
  ".content-block__heading",
  ".content-block__body",
  ".blog-entry__summary",
  ".contact-page p",
  ".contact-info strong",
  ".contact-form label",
].join(",");

const scrambleGlyphs = "01▓▒░<>/\\|-+*#";

function transmissionMetrics(element, measure) {
  const style = getComputedStyle(element);
  measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return {
    columns: Math.max(1, Math.floor(element.clientWidth / (measure.measureText("M").width || 11))),
    rows: Math.max(1, Math.floor(element.clientHeight / (Number.parseFloat(style.lineHeight) || 22))),
  };
}

function transmissionGlyph(position, sourceIndex, interval) {
  const tick = Math.floor(performance.now() / interval);
  return scrambleGlyphs[Math.floor(hash2d(position, tick, sourceIndex) * scrambleGlyphs.length)];
}

function startRightAnchoredTransmission(element, text, options = {}) {
  if (!element || !text) return;
  const measure = document.createElement("canvas").getContext("2d");
  const interval = options.interval ?? 65;
  const commaPause = options.commaPause ?? 300;
  const sentencePause = options.sentencePause ?? 1000;
  const segments = (Array.isArray(text) ? text : [text])
    .map((segment) => String(segment || ""))
    .filter((segment) => segment.trim().length > 0);
  let columns = 1;
  let settled = "";
  let tail = [];
  let segmentIndex = 0;
  let characterIndex = 0;
  let sourceIndex = 0;
  let cycleTick = 0;
  let highlightLatest = false;
  let timer = 0;

  const render = () => {
    const characters = [
      ...[...settled].map((character, index) => ({
        character,
        className: highlightLatest && index === settled.length - 1 ? "transmission-current" : "",
      })),
      ...tail.map((item, index) => ({
        character: /\s/.test(item.character)
          ? item.character
          : transmissionGlyph(item.seed + index, cycleTick, interval),
        className: "transmission-tail",
      })),
    ].slice(-columns);
    const fragment = document.createDocumentFragment();
    fragment.append(document.createTextNode(" ".repeat(Math.max(0, columns - characters.length))));
    characters.forEach(({ character, className }) => {
      if (!className) {
        fragment.append(document.createTextNode(character));
        return;
      }
      const span = document.createElement("span");
      span.className = className;
      span.textContent = character;
      fragment.append(span);
    });
    element.replaceChildren(fragment);
  };

  const settleTailCharacter = () => {
    const item = tail.shift();
    if (!item) return false;
    settled = `${settled}${item.character}`.slice(-columns);
    highlightLatest = true;
    return true;
  };

  const enqueueCharacter = (character) => {
    tail.push({ character, seed: sourceIndex });
    sourceIndex += 1;
    if (tail.length > 3) settleTailCharacter();
    render();
  };

  const resize = () => {
    columns = transmissionMetrics(element, measure).columns;
    settled = settled.slice(-columns);
    render();
  };

  const step = () => {
    const segment = segments[segmentIndex % segments.length];
    if (characterIndex >= segment.length) {
      if (settleTailCharacter()) {
        render();
        timer = window.setTimeout(step, interval);
        return;
      }
      highlightLatest = false;
      render();
      segmentIndex = (segmentIndex + 1) % segments.length;
      characterIndex = 0;
      timer = window.setTimeout(step, sentencePause);
      return;
    }

    const character = segment[characterIndex];
    const nextCharacter = segment[characterIndex + 1] || "";
    enqueueCharacter(character);
    characterIndex += 1;
    const delay = character === ","
      ? commaPause
      : nextCharacter && /[.!?]/.test(character) && !/[.!?]/.test(nextCharacter)
        ? sentencePause
        : interval;
    timer = window.setTimeout(step, delay);
  };

  resize();
  new ResizeObserver(resize).observe(element);
  if (prefersReducedMotion()) {
    settled = segments.join(" ").slice(-columns);
    tail = [];
    highlightLatest = false;
    render();
    return;
  }
  window.setInterval(() => {
    if (!tail.length) return;
    cycleTick += 1;
    render();
  }, 42);
  step();
}

function startTopDownTransmission(element, text, options = {}) {
  if (!element || !text) return;
  const measure = document.createElement("canvas").getContext("2d");
  const interval = options.interval ?? 65;
  const phrasePause = options.phrasePause ?? 100;
  const phrases = (Array.isArray(text) ? text : text.split(/\s*\.\.\.\s*/))
    .map((phrase) => phrase.trim())
    .filter(Boolean);
  let columns = 1;
  let rows = 1;
  let cells = [];
  let tail = [];
  let pointer = 0;
  let filled = 0;
  let phraseIndex = 0;
  let characterIndex = 0;
  let delimiterIndex = 0;
  let currentCell = -1;
  let sourceIndex = 0;
  let cycleTick = 0;
  let timer = 0;

  const render = () => {
    const capacity = cells.length;
    const visibleLength = capacity
      ? Math.min(capacity, filled === capacity ? capacity : Math.max(filled, pointer + tail.length))
      : 0;
    const tailCells = new Map(
      tail.map((item, index) => [
        (pointer + index) % capacity,
        {
          character: /\s/.test(item.character)
            ? item.character
            : transmissionGlyph(item.seed + index, cycleTick, interval),
          className: "terminal-buffer__tail",
        },
      ]),
    );
    const fragment = document.createDocumentFragment();
    let textRun = "";
    const flushText = () => {
      if (!textRun) return;
      fragment.append(document.createTextNode(textRun));
      textRun = "";
    };
    for (let index = 0; index < visibleLength; index += 1) {
      const tailCell = tailCells.get(index);
      const character = tailCell?.character ?? cells[index];
      const className = tailCell?.className
        || (index === currentCell ? "terminal-buffer__current" : "");
      if (className) {
        flushText();
        const span = document.createElement("span");
        span.className = className;
        span.textContent = character;
        fragment.append(span);
      } else {
        textRun += character;
      }
      if ((index + 1) % columns === 0 && index < visibleLength - 1) textRun += "\n";
    }
    flushText();
    element.replaceChildren(fragment);
  };

  const resize = () => {
    const metrics = transmissionMetrics(element, measure);
    const previous = cells.slice(0, filled).join("");
    columns = metrics.columns;
    rows = metrics.rows;
    const capacity = columns * rows;
    cells = Array(capacity).fill(" ");
    [...previous.slice(0, capacity)].forEach((character, index) => {
      cells[index] = character;
    });
    filled = Math.min(previous.length, capacity);
    pointer = filled === capacity ? 0 : filled;
    currentCell = -1;
    render();
  };

  const settleTailCharacter = () => {
    const item = tail.shift();
    if (!item || !cells.length) return false;
    cells[pointer] = item.character;
    currentCell = pointer;
    filled = Math.max(filled, pointer + 1);
    pointer = (pointer + 1) % cells.length;
    return true;
  };

  const enqueueCharacter = (character) => {
    tail.push({ character, seed: sourceIndex });
    sourceIndex += 1;
    if (tail.length > 3) settleTailCharacter();
    render();
    timer = window.setTimeout(step, interval);
  };

  const step = () => {
    const phrase = phrases[phraseIndex % phrases.length];
    if (characterIndex < phrase.length) {
      enqueueCharacter(phrase[characterIndex]);
      characterIndex += 1;
      return;
    }
    if (delimiterIndex < 3) {
      enqueueCharacter(".");
      delimiterIndex += 1;
      return;
    }
    if (settleTailCharacter()) {
      render();
      timer = window.setTimeout(step, interval);
      return;
    }

    currentCell = -1;
    render();
    phraseIndex = (phraseIndex + 1) % phrases.length;
    characterIndex = 0;
    delimiterIndex = 0;
    timer = window.setTimeout(step, phrasePause);
  };

  resize();
  new ResizeObserver(resize).observe(element);
  if (prefersReducedMotion()) {
    const capacity = columns * rows;
    const normalized = `${phrases.join("...")}...`;
    const repeated = normalized.repeat(Math.ceil(capacity / normalized.length) + 1);
    cells = [...repeated.slice(0, capacity)];
    filled = capacity;
    tail = [];
    currentCell = -1;
    render();
    return;
  }
  window.setInterval(() => {
    if (!tail.length) return;
    cycleTick += 1;
    render();
  }, 42);
  window.clearTimeout(timer);
  step();
}

function startLegacyTransmissions() {
  const timingValue = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const timing = {
    interval: timingValue(transmissionData.typingSpeed, 65),
    commaPause: timingValue(transmissionData.commaPause, 300),
    sentencePause: timingValue(transmissionData.sentencePause, 1000),
    phrasePause: timingValue(transmissionData.phrasePause, 100),
  };
  startRightAnchoredTransmission($("#header-transmission-text"), transmissionData.header, timing);
  startTopDownTransmission($("#ego-stream"), transmissionData.ego, timing);
  startTopDownTransmission($("#shadow-stream"), transmissionData.shadow, timing);
}

const manifestPathTransmission = `))))))))))))))))))))))))))))))))))))))))))))?${">".repeat(180)}\n\n${" ".repeat(168)}┬────┐\n${" ".repeat(168)}│    └── MANIFEST.TXT\n${" ".repeat(168)}└─────── SOMETHING CONTINUES OUT THERE`;
const manifestTeaseTransmission = "wooooow hey there fella, hold your horses.\n\nlike, where is this smiling guy GOING??? am I RIIIGHT???\nha! got em.\n\nno seriously though, what's there? oh nothing, just darkness. maybe a black hole. maybe a pic. maybe there's an easter egg in here. did you think easter eggs are cool? it's so much extra work just so you could go 'heh'. no, there are no extra eggs. and don't look over there, understood???";
const costcoPathTransmission = "THE END. FIN. КОНЕЦ.\n\n        ┬────┐\n        │    └── COSTCO.EXE\n        └───────";
const easterPathTransmission = "┬\n┐\n┌\n─\n┴\n┘\n└\n│\n┼\n┤\n├\n╦\n╗\n╔\n═\n╩\n╝\n╚\n║\n╬\n╣\n╠\n\nOFFSCREEN_EGG.RU / SIGNAL RECOVERED";
const secretTypingTokens = new WeakMap();

function signedDaysAgo() {
  const signedAt = Date.UTC(2025, 3, 2);
  return Math.max(0, Math.floor((Date.now() - signedAt) / 86400000));
}

function updateLegacySignatures() {
  const text = `DAVID SIGNED THIS ${signedDaysAgo()} DAYS AGO / 2025-04-02`;
  const manifestSignature = $("#manifest-signature-age");
  const offscreenSignature = $("#offscreen-signature-age");
  const costcoSignature = $("#costco-signature-age");
  if (manifestSignature) manifestSignature.textContent = text;
  if (offscreenSignature) offscreenSignature.textContent = text;
  if (costcoSignature) costcoSignature.textContent = text;
}

function revealLegacyBlocks(container, config) {
  if (!container || !config) return;
  renderContentBlocks(container, config);
  $$('[data-scroll-media-reveal]', container).forEach((media) => {
    media.removeAttribute("data-scroll-media-reveal");
  });
}

async function typeSecretTransmission(element, source, interval = 12) {
  if (!element) return;
  const runId = (secretTypingTokens.get(element) || 0) + 1;
  secretTypingTokens.set(element, runId);
  if (prefersReducedMotion()) {
    element.textContent = source;
    return;
  }

  for (let end = 1; end <= source.length; end += 1) {
    if (secretTypingTokens.get(element) !== runId || !element.isConnected) return;
    const settledEnd = Math.max(0, end - 3);
    const settled = source.slice(0, settledEnd);
    const tail = [...source.slice(settledEnd, end)].map((character, index) => {
      if (/\s/.test(character)) return character;
      return transmissionGlyph(settledEnd + index, end, Math.max(16, interval));
    }).join("");
    element.textContent = settled + tail;
    await wait(interval);
  }

  for (let remaining = 2; remaining >= 0; remaining -= 1) {
    if (secretTypingTokens.get(element) !== runId) return;
    const split = source.length - remaining;
    const settled = source.slice(0, split);
    const tail = [...source.slice(split)].map((character, index) => (
      /\s/.test(character) ? character : transmissionGlyph(split + index, remaining, 18)
    )).join("");
    element.textContent = settled + tail;
    await wait(interval);
  }
  element.textContent = source;
}

function positionManifestTeaser(section, originElement) {
  const shell = $(".site-shell");
  if (!section || !shell || !originElement) return;
  const shellRect = shell.getBoundingClientRect();
  const originRect = originElement.getBoundingClientRect();
  const teaserWidth = Math.min(720, Math.max(320, shellRect.width * 0.55));
  const left = clamp(
    originRect.left - shellRect.left + Math.min(44, originRect.width * 0.5),
    11,
    Math.max(11, shellRect.width - teaserWidth - 11),
  );
  const top = Math.max(22, originRect.bottom - shellRect.top + 11);
  section.style.left = `${Math.round(left / 11) * 11}px`;
  section.style.top = `${Math.round(top / 11) * 11}px`;
}

async function revealManifestDescent(originElement = null) {
  if (document.body.dataset.view !== "os") return;
  const section = $("#manifest-descent");
  if (!section) return;
  if (state.secrets.manifest) return;

  state.secrets.manifest = true;
  section.hidden = false;
  positionManifestTeaser(section, originElement);
  await typeSecretTransmission($("#manifest-path-text"), manifestPathTransmission, 10);
  await typeSecretTransmission($("#manifest-tease-text"), manifestTeaseTransmission, 7);
}

let costcoBeyondObserver = null;

function armCostcoBeyondFooter() {
  const marker = $(".costco-descent__footer");
  const beyond = $("#costco-beyond-footer");
  if (!marker || !beyond) return;
  beyond.hidden = true;
  costcoBeyondObserver?.disconnect();

  if (!("IntersectionObserver" in window)) return;
  costcoBeyondObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    costcoBeyondObserver?.disconnect();
    costcoBeyondObserver = null;
    beyond.hidden = false;
    markScrambleTargets(beyond);
    runInterfaceSplitFlap(beyond, 620, 0.56);
  }, { threshold: 0.35 });
  costcoBeyondObserver.observe(marker);
}

async function revealCostcoDescent() {
  if (document.body.dataset.view !== "os" || !state.secrets.cheatCode) return;
  const section = $("#costco-descent");
  if (!section || state.secrets.costco) return;

  state.secrets.costco = true;
  section.hidden = false;
  updateLegacySignatures();

  const config = projectConfig("costco-outro");
  const blocks = Array.isArray(config?.blocks) ? config.blocks : [];
  revealLegacyBlocks($("#costco-welcome-content"), { ...config, blocks: blocks.slice(0, 1) });
  revealLegacyBlocks($("#costco-end-content"), { ...config, blocks: blocks.slice(1) });

  const manifestConfig = projectConfig("myth-manifest");
  const myth = manifestConfig?.blocks?.find((block) => block.id === "manifest-text")?.body || "";
  const signoff = manifestConfig?.blocks?.find((block) => block.id === "manifest-image")?.body || "MY MYTH [MANIFEST]";
  const manifestFooter = $("#manifest-footer");
  const mythBackground = $("#manifest-footer-myth");
  const footerSignoff = $("#manifest-footer-signoff");
  if (mythBackground) mythBackground.textContent = `${myth}\n\n${myth}\n\n${myth}`;
  if (footerSignoff) footerSignoff.textContent = signoff;
  if (manifestFooter) manifestFooter.hidden = false;

  const beyond = $("#costco-beyond-footer");
  if (beyond) beyond.hidden = true;
  armCostcoBeyondFooter();
  await typeSecretTransmission($("#costco-path-text"), costcoPathTransmission, 8);
  markScrambleTargets($("#costco-welcome-content"));
  markScrambleTargets(manifestFooter);
  await Promise.all([
    runInterfaceSplitFlap($("#costco-welcome-content"), 620, 0.56),
    runInterfaceSplitFlap(manifestFooter, 620, 0.56),
  ]);
}

function nudgeTowardCheatCode() {
  const button = $("#cheat-code-toggle");
  if (!button) return;
  const rect = button.getBoundingClientRect();
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const required = Math.max(0, rect.bottom - (window.innerHeight - 22));
  const available = Math.max(0, maxScroll - window.scrollY);
  const distance = Math.min(available, required || 66);
  if (distance > 0) window.scrollBy({ top: distance, behavior: "smooth" });
}

async function runCostcoErrorWindow(originElement) {
  if ($(".costco-error-window")) return false;
  const originRect = originElement?.getBoundingClientRect();
  const width = Math.min(660, Math.max(320, window.innerWidth - 44));
  const height = Math.min(242, Math.max(176, window.innerHeight - 88));
  const left = Math.max(22, Math.round((window.innerWidth - width) / 2));
  const top = Math.max(44, Math.round((window.innerHeight - height) / 2));
  const errorWindow = document.createElement("aside");
  errorWindow.className = "window costco-error-window";
  errorWindow.setAttribute("role", "status");
  errorWindow.setAttribute("aria-live", "polite");
  errorWindow.innerHTML = `
    <header class="window__titlebar">
      <h2>HMM_SOMETHING_IS_WRONG_WITH_THIS.EXE</h2>
      <span>[!]</span>
    </header>
    <pre class="costco-error-window__body"></pre>
  `;
  Object.assign(errorWindow.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  });
  document.body.append(errorWindow);

  if (!prefersReducedMotion() && originRect) {
    const scaleX = Math.max(0.05, originRect.width / width);
    const scaleY = Math.max(0.05, originRect.height / height);
    const opening = errorWindow.animate([
      {
        opacity: 0.35,
        transform: `translate(${originRect.left - left}px, ${originRect.top - top}px) scale(${scaleX}, ${scaleY})`,
        transformOrigin: "0 0",
      },
      { opacity: 1, transform: "translate(0, 0) scale(1)", transformOrigin: "0 0" },
    ], {
      duration: 380,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "both",
    });
    await opening.finished.catch(() => {});
  }

  const errorText = "ERROR ERROR ERROR ERROR\nSOMETHING IS WRONG WITH THIS WINDOW\nOH NOOOOOOO\nBOOOOOOOOOOOOOOOO\n///END";
  await typeSecretTransmission($(".costco-error-window__body", errorWindow), errorText, 18);
  await wait(1000);

  if (!prefersReducedMotion()) {
    const closing = errorWindow.animate([
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 1, transform: `translateY(${window.innerHeight - top + height}px)` },
    ], {
      duration: 560,
      easing: "cubic-bezier(0.7, 0, 1, 0.5)",
      fill: "forwards",
    });
    await closing.finished.catch(() => {});
  }
  errorWindow.remove();
  return true;
}

async function cueCostcoDescent(originElement = null) {
  if (document.body.dataset.view !== "os") return;
  state.secrets.costcoRequested = true;
  const launched = await runCostcoErrorWindow(originElement);
  if (!launched) return;
  nudgeTowardCheatCode();
  await showGlyphCursorMessage("OH THERE'S MORE??", $("#cheat-code-toggle"));
  if (state.secrets.cheatCode) await revealCostcoDescent();
}

function setCheatCode(enabled) {
  const next = Boolean(enabled);
  state.secrets.cheatCode = next;
  document.documentElement.classList.toggle("cheat-code-enabled", next);
  document.body.classList.toggle("cheat-code-enabled", next);
  const button = $("#cheat-code-toggle");
  const dimension = $("#cheat-dimension");
  if (button) {
    button.setAttribute("aria-pressed", String(next));
    const label = $(".control-label", button) || button;
    interactiveLabelTokens.set(label, (interactiveLabelTokens.get(label) || 0) + 1);
    label.classList.remove("is-interactive-scrambling");
    label.textContent = `[CHEAT CODE: ${next ? "ON" : "OFF"}]`;
    interactiveLabelText.set(label, label.textContent);
  }
  if (dimension) dimension.hidden = !next;
  if (!next) {
    state.secrets.easterEgg = false;
    const egg = $("#offscreen-egg");
    if (egg) egg.hidden = true;
    const costco = $("#costco-descent");
    if (costco) costco.hidden = true;
    state.secrets.costco = false;
    costcoBeyondObserver?.disconnect();
    costcoBeyondObserver = null;
    if (window.scrollX) window.scrollTo({ left: 0, top: window.scrollY, behavior: "smooth" });
  }
}

async function toggleCheatCode() {
  if (mobileGridOnly()) return;
  if (document.body.dataset.view !== "os") await transitionView("os");
  if (document.body.dataset.view !== "os") return;
  setCheatCode(!state.secrets.cheatCode);
  if (state.secrets.cheatCode) {
    markScrambleTargets($("#cheat-dimension"));
    runInterfaceSplitFlap($("#easter-egg-file"), 520, 0.58);
    if (state.secrets.costcoRequested) revealCostcoDescent();
    await wait(80);
    window.scrollBy({ top: 88, behavior: "smooth" });
  }
}

async function revealOffscreenEgg() {
  if (!state.secrets.cheatCode || state.secrets.easterEgg) return;
  state.secrets.easterEgg = true;
  const egg = $("#offscreen-egg");
  const content = $("#offscreen-content");
  egg.hidden = false;
  revealLegacyBlocks(content, projectConfig("offscreen-easter-egg"));
  content.hidden = true;
  updateLegacySignatures();
  await typeSecretTransmission($("#easter-path-text"), easterPathTransmission, 10);
  content.hidden = false;
  markScrambleTargets(content);
  await runInterfaceSplitFlap(content, 760, 0.56);
}

function markScrambleTargets(root = document) {
  const targets = [];
  if (root.matches?.(scrambleSelector)) targets.push(root);
  targets.push(...$$(scrambleSelector, root));
  targets.forEach((element) => element.setAttribute("data-scramble", ""));
  return targets;
}

function scrambleElement(element, duration = 800, delay = 0, settleStart = 0) {
  if (animationsDisabled) return Promise.resolve();
  const finalText = element.textContent;
  if (!finalText.trim()) return Promise.resolve();

  const color = getComputedStyle(element).color;
  element.setAttribute("data-scramble", "");
  element.style.setProperty("--scramble-color", color);
  element.classList.add("is-scrambling");
  element.setAttribute("data-scramble-display", finalText.replace(/\S/g, "░"));

  return wait(delay).then(
    () =>
      new Promise((resolve) => {
        const started = performance.now();
        let previousTick = -1;
        const frame = (now) => {
          const progress = clamp((now - started) / duration);
          const settleProgress = clamp((progress - settleStart) / Math.max(0.01, 1 - settleStart));
          const settled = Math.floor(settleProgress * finalText.length);
          const tick = Math.floor((now - started) / 42);

          if (tick !== previousTick || progress === 1) {
            previousTick = tick;
            const display = [...finalText]
              .map((character, index) => {
                if (/\s/.test(character) || index < settled) return character;
                const glyphIndex = Math.floor(hash2d(index, tick, finalText.length) * scrambleGlyphs.length);
                return scrambleGlyphs[glyphIndex];
              })
              .join("");
            element.setAttribute("data-scramble-display", display);
          }

          if (progress < 1) {
            requestAnimationFrame(frame);
          } else {
            element.classList.remove("is-scrambling");
            element.removeAttribute("data-scramble-display");
            element.style.removeProperty("--scramble-color");
            resolve();
          }
        };
        requestAnimationFrame(frame);
      }),
  );
}

const interactiveGlitchTokens = new WeakMap();
const interactiveLabelTokens = new WeakMap();
const interactiveLabelText = new WeakMap();

function interactiveGlitchTarget(control) {
  return $(".control-label", control) || $("h1", control) || control;
}

function scrambleInteractiveLabel(control, duration = 420) {
  if (animationsDisabled) return Promise.resolve();
  const target = interactiveGlitchTarget(control);
  const finalText = interactiveLabelText.get(target) || target.textContent;
  if (!finalText.trim()) return Promise.resolve();
  interactiveLabelText.set(target, finalText);
  const token = (interactiveLabelTokens.get(target) || 0) + 1;
  interactiveLabelTokens.set(target, token);
  target.classList.remove("is-scrambling");
  target.removeAttribute("data-scramble-display");
  target.classList.add("is-interactive-scrambling");

  return new Promise((resolve) => {
    const started = performance.now();
    let previousTick = -1;
    const frame = (now) => {
      if (interactiveLabelTokens.get(target) !== token) {
        resolve();
        return;
      }
      const progress = clamp((now - started) / duration);
      const settleProgress = clamp((progress - 0.34) / 0.66);
      const settled = Math.floor(settleProgress * finalText.length);
      const tick = Math.floor((now - started) / 42);

      if (tick !== previousTick || progress === 1) {
        previousTick = tick;
        target.textContent = [...finalText]
          .map((character, index) => {
            if (/\s/.test(character) || index < settled) return character;
            const glyphIndex = Math.floor(hash2d(index, tick, finalText.length) * scrambleGlyphs.length);
            return scrambleGlyphs[glyphIndex];
          })
          .join("");
      }

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        target.textContent = finalText;
        target.classList.remove("is-interactive-scrambling");
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

function beginInteractiveGlitch(control) {
  if (animationsDisabled) return;
  const token = (interactiveGlitchTokens.get(control) || 0) + 1;
  interactiveGlitchTokens.set(control, token);
  control.dataset.glitchLink = "";
  control.classList.remove("is-negative");
  scrambleInteractiveLabel(control).then(() => {
    if (
      interactiveGlitchTokens.get(control) === token
      && !control.matches(".project-tree__row")
      && control.matches(":hover, :focus-visible")
    ) {
      control.classList.add("is-negative");
    }
  });
}

function endInteractiveGlitch(control) {
  interactiveGlitchTokens.set(control, (interactiveGlitchTokens.get(control) || 0) + 1);
  const target = interactiveGlitchTarget(control);
  const finalText = interactiveLabelText.get(target);
  if (finalText !== undefined) target.textContent = finalText;
  target.classList.remove("is-interactive-scrambling");
  control.classList.remove("is-negative");
  delete control.dataset.glitchLink;
}

function scrambleTree(root, duration = 850, settleStart = 0) {
  const targets = markScrambleTargets(root);
  return Promise.all(
    targets.map((element, index) => scrambleElement(element, duration, index * 24, settleStart)),
  );
}

function parseCssColor(color) {
  const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  return values?.length === 3 ? values : [216, 216, 211];
}

function extractContentTargets(root, canvas) {
  const canvasRect = canvas.getBoundingClientRect();
  const targets = [];

  $$('[data-scramble]', root).forEach((element) => {
    const elementRect = element.getBoundingClientRect();
    if (!elementRect.width || !elementRect.height) return;
    const color = parseCssColor(getComputedStyle(element).color);
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode;

    while ((textNode = walker.nextNode())) {
      [...textNode.data].forEach((character, index) => {
        if (/\s/.test(character)) return;
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + 1);
        const rect = range.getBoundingClientRect();
        if (!rect.width && !rect.height) return;
        targets.push({
          x: rect.left - canvasRect.left + rect.width / 2,
          y: rect.top - canvasRect.top + rect.height / 2,
          character,
          color,
        });
      });
    }
  });

  return targets;
}

function waitForEvent(target, eventName, timeout = 3000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      target.removeEventListener(eventName, finish);
      resolve();
    };
    target.addEventListener(eventName, finish, { once: true });
    setTimeout(finish, timeout);
  });
}

function animateValue(from, to, duration, update) {
  if (animationsDisabled || duration <= 0) {
    update(to);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const started = performance.now();
    const frame = (now) => {
      const progress = clamp((now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      update(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

class AsciiMediaRenderer {
  constructor(canvas, source, options = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: true });
    this.source = source;
    this.fontSize = options.fontSize ?? 22;
    this.lineHeight = options.lineHeight ?? 22;
    this.palette = options.palette ?? "  .·:+*░▒▓█";
    this.monochrome = options.monochrome ?? false;
    this.fit = options.fit ?? "cover";
    this.lumaGain = options.lumaGain ?? 1;
    this.colorGain = options.colorGain ?? 1;
    this.contrast = options.contrast ?? 1;
    this.seed = options.seed ?? Math.random() * 100;
    this.reveal = 0;
    this.maskTransition = false;
    this.logoContainProgress = null;
    this.contentTransitionProgress = null;
    this.mediaScrambleProgress = null;
    this.cellDissolveProgress = null;
    this.contentTargets = [];
    this.contentMap = new Map();
    this.maskImage = options.maskImage ?? null;
    this.running = false;
    this.lastFrame = 0;
    this.frameInterval = 1000 / (options.fps ?? 24);
    this.targetRects = options.targetRects ?? [];
    this.sampleCanvas = document.createElement("canvas");
    this.sampleContext = this.sampleCanvas.getContext("2d", {
      alpha: false,
      willReadFrequently: true,
    });
    this.maskCanvas = document.createElement("canvas");
    this.maskContext = this.maskCanvas.getContext("2d", { willReadFrequently: true });
    this.maskPixels = null;
    this.staticSample = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.ceil(rect.width * dpr);
    this.canvas.height = Math.ceil(rect.height * dpr);
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.context.font = `${this.fontSize}px "Departure Mono", monospace`;
    this.context.textBaseline = "alphabetic";
    this.cellWidth = Math.max(6, Math.round(this.context.measureText("M").width));
    this.columns = Math.max(1, Math.ceil(rect.width / this.cellWidth));
    this.rows = Math.max(1, Math.ceil(rect.height / this.lineHeight));
    this.sampleCanvas.width = this.columns;
    this.sampleCanvas.height = this.rows;
    this.staticSample = null;
    this.buildMask();
    this.buildContentMap();
  }

  setReveal(value) {
    this.reveal = clamp(value);
  }

  setSource(source) {
    this.source = source;
    this.staticSample = null;
  }

  setMaskTransition(active) {
    this.maskTransition = active;
  }

  setLogoContainProgress(value) {
    this.logoContainProgress = value === null ? null : clamp(value);
  }

  setContentTargets(targets) {
    this.contentTargets = targets;
    this.buildContentMap();
  }

  setContentTransitionProgress(value) {
    this.contentTransitionProgress = value === null ? null : clamp(value);
  }

  setMediaScrambleProgress(value) {
    this.mediaScrambleProgress = value === null ? null : clamp(value);
  }

  setCellDissolveProgress(value) {
    this.cellDissolveProgress = value === null ? null : clamp(value);
  }

  buildContentMap() {
    this.contentMap = new Map();
    if (!this.cellWidth || !this.lineHeight) return;
    this.contentTargets.forEach((target) => {
      const x = clamp(Math.floor(target.x / this.cellWidth), 0, this.columns - 1);
      const y = clamp(Math.floor(target.y / this.lineHeight), 0, this.rows - 1);
      this.contentMap.set(y * this.columns + x, target);
    });
  }

  buildMask() {
    this.maskCanvas.width = this.columns;
    this.maskCanvas.height = this.rows;
    this.maskContext.clearRect(0, 0, this.columns, this.rows);
    if (!this.maskImage?.naturalWidth || !this.maskImage?.naturalHeight) {
      this.maskPixels = null;
      return;
    }

    const maxWidth = this.columns * this.cellWidth * 0.92;
    const maxHeight = this.rows * this.lineHeight * 0.88;
    const scale = Math.min(
      maxWidth / this.maskImage.naturalWidth,
      maxHeight / this.maskImage.naturalHeight,
    );
    const width = (this.maskImage.naturalWidth * scale) / this.cellWidth;
    const height = (this.maskImage.naturalHeight * scale) / this.lineHeight;
    const x = (this.columns - width) / 2;
    const y = (this.rows - height) / 2;
    this.maskContext.drawImage(this.maskImage, x, y, width, height);
    this.maskPixels = this.maskContext.getImageData(0, 0, this.columns, this.rows).data;
  }

  isInsideTarget(x, y) {
    if (!this.targetRects.length || !this.cssWidth || !this.cssHeight) return false;
    const px = (x / this.columns) * this.cssWidth;
    const py = (y / this.rows) * this.cssHeight;
    return this.targetRects.some(
      (rect) => px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom,
    );
  }

  drawSourceToSamples() {
    const sourceWidth = this.source.videoWidth || this.source.naturalWidth || 1;
    const sourceHeight = this.source.videoHeight || this.source.naturalHeight || 1;
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = this.cssWidth / this.cssHeight;
    this.sampleContext.fillStyle = "#000000";
    this.sampleContext.fillRect(0, 0, this.columns, this.rows);

    if (this.fit === "contain") {
      const scale = Math.min(this.cssWidth / sourceWidth, this.cssHeight / sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      const dx = ((this.cssWidth - drawWidth) / this.cssWidth) * this.columns;
      const dy = ((this.cssHeight - drawHeight) / this.cssHeight) * this.rows;
      const dw = (drawWidth / this.cssWidth) * this.columns;
      const dh = (drawHeight / this.cssHeight) * this.rows;
      this.sampleContext.drawImage(this.source, 0, 0, sourceWidth, sourceHeight, dx, dy, dw, dh);
      return;
    }
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;

    if (sourceAspect > targetAspect) {
      sw = sourceHeight * targetAspect;
      sx = (sourceWidth - sw) / 2;
    } else {
      sh = sourceWidth / targetAspect;
      sy = (sourceHeight - sh) / 2;
    }

    this.sampleContext.drawImage(
      this.source,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      this.columns,
      this.rows,
    );
  }

  sourcePixels() {
    const cacheable = this.source instanceof HTMLImageElement;
    if (
      cacheable
      && this.staticSample?.source === this.source
      && this.staticSample.columns === this.columns
      && this.staticSample.rows === this.rows
    ) {
      return this.staticSample.pixels;
    }

    this.drawSourceToSamples();
    const pixels = this.sampleContext.getImageData(0, 0, this.columns, this.rows).data;
    if (cacheable) {
      this.staticSample = {
        source: this.source,
        columns: this.columns,
        rows: this.rows,
        pixels,
      };
    }
    return pixels;
  }

  render() {
    if (!this.cssWidth || !this.cssHeight) return;

    let pixels;
    try {
      pixels = this.sourcePixels();
    } catch {
      return;
    }
    this.context.clearRect(0, 0, this.cssWidth, this.cssHeight);
    this.context.font = `${this.fontSize}px "Departure Mono", monospace`;
    this.context.textBaseline = "alphabetic";

    if (
      this.reveal === 0 &&
      this.contentTransitionProgress === null &&
      this.logoContainProgress === null &&
      this.cellDissolveProgress === null
    ) {
      this.context.fillStyle = "#000000";
      this.context.fillRect(0, 0, this.cssWidth, this.cssHeight);
    }

    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        const cellIndex = y * this.columns + x;
        const index = cellIndex * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const noise = hash2d(x, y, this.seed);
        const band = (x / this.columns) * 0.14 + (y / this.rows) * 0.08;
        const targetBias = this.isInsideTarget(x, y) ? -0.18 : 0.08;
        const maskAlpha = this.maskPixels ? this.maskPixels[index + 3] / 255 : 0;
        const threshold = this.maskTransition
          ? clamp(maskAlpha > 0.05 ? 0.02 + noise * 0.17 : 0.2 + (luma / 255) * 0.48 + noise * 0.3)
          : clamp(noise * 0.5 + (luma / 255) * 0.25 + band + targetBias);

        const contrastedLuma = Math.max(0, Math.min(255, (luma - 127.5) * this.contrast + 127.5));
        const displayLuma = Math.min(255, contrastedLuma * this.lumaGain);
        const glyphIndex = Math.min(
          this.palette.length - 1,
          Math.floor((displayLuma / 256) * this.palette.length),
        );
        let glyph = this.palette[glyphIndex];
        const colorLift = (0.74 + (displayLuma / 255) * 0.34) * this.colorGain;
        let drawRed = Math.max(
          0,
          Math.min(255, Math.round(((r - 127.5) * this.contrast + 127.5) * colorLift)),
        );
        let drawGreen = Math.max(
          0,
          Math.min(255, Math.round(((g - 127.5) * this.contrast + 127.5) * colorLift)),
        );
        let drawBlue = Math.max(
          0,
          Math.min(255, Math.round(((b - 127.5) * this.contrast + 127.5) * colorLift)),
        );
        if (this.monochrome) {
          const gray = Math.min(255, Math.round(displayLuma * colorLift));
          drawRed = gray;
          drawGreen = gray;
          drawBlue = gray;
        }

        if (this.mediaScrambleProgress !== null) {
          const progress = this.mediaScrambleProgress;
          const appearGate = 0.04 + noise * 0.68;
          if (progress < appearGate) continue;
          const settleGate = 0.5 + noise * 0.48;
          if (progress < settleGate) {
            const cycle = Math.floor(performance.now() / 42);
            const cycleIndex = Math.floor(
              hash2d(x, y, cycle + this.seed) * scrambleGlyphs.length,
            );
            glyph = scrambleGlyphs[cycleIndex];
          }
        }

        if (this.contentTransitionProgress !== null) {
          const progress = this.contentTransitionProgress;
          const target = this.contentMap.get(cellIndex);

          if (target) {
            const carriedByLogo = this.maskPixels && maskAlpha > 0.05;
            const appearGate = noise * 0.3;
            if (!carriedByLogo && progress < appearGate) continue;

            const settleGate = 0.72 + noise * 0.2;
            if (progress >= settleGate) {
              glyph = target.character;
            } else {
              const cycle = Math.floor(progress * 36);
              const cycleIndex = Math.floor(hash2d(x, y, cycle + this.seed) * scrambleGlyphs.length);
              glyph = scrambleGlyphs[cycleIndex];
            }

            const colorProgress = clamp((progress - 0.32) / 0.68);
            drawRed = Math.round(drawRed + (target.color[0] - drawRed) * colorProgress);
            drawGreen = Math.round(drawGreen + (target.color[1] - drawGreen) * colorProgress);
            drawBlue = Math.round(drawBlue + (target.color[2] - drawBlue) * colorProgress);
            const domHandoff = clamp((progress - 0.68) / 0.32);
            if (domHandoff > noise) continue;
          } else {
            const carriedByLogo = this.maskPixels ? maskAlpha > 0.05 : true;
            const fadeGate = 0.08 + noise * 0.62 + (luma / 255) * 0.2;
            if (!carriedByLogo || progress > fadeGate) continue;
          }
        } else if (this.logoContainProgress !== null && this.maskPixels) {
          const progress = this.logoContainProgress;
          const insideGate = noise * 0.54 + (luma / 255) * 0.38;
          const outsideGate = 0.08 + noise * 0.72;
          const visible = maskAlpha > 0.05
            ? progress >= insideGate
            : progress < outsideGate;
          if (!visible) continue;
        } else if (this.reveal > threshold) {
          continue;
        }

        this.context.globalAlpha = 1;
        if (this.cellDissolveProgress !== null) {
          const delay = hash2d(x, y, this.seed + 73) * 0.76;
          const localProgress = clamp((this.cellDissolveProgress - delay) / 0.24);
          if (localProgress >= 1) continue;
          this.context.globalAlpha = localProgress < 0.34
            ? 1
            : localProgress < 0.67
              ? 0.58
              : 0.24;
        }

        if (
          this.reveal > 0 ||
          this.contentTransitionProgress !== null ||
          this.cellDissolveProgress !== null
        ) {
          this.context.fillStyle = "#000000";
          this.context.fillRect(
            x * this.cellWidth,
            y * this.lineHeight,
            this.cellWidth + 1,
            this.lineHeight + 1,
          );
        }

        this.context.fillStyle = `rgb(${drawRed} ${drawGreen} ${drawBlue})`;
        this.context.fillText(
          glyph,
          x * this.cellWidth,
          (y + 1) * this.lineHeight - Math.max(1, this.lineHeight - this.fontSize),
        );
      }
    }
    this.context.globalAlpha = 1;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (now) => {
      if (!this.running) return;
      if (now - this.lastFrame >= this.frameInterval) {
        this.lastFrame = now;
        this.render();
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    this.resizeObserver.disconnect();
  }
}

function drawGlyphNoise(frame = state.glyphNoise.frame) {
  const canvas = $("#glyph-noise");
  const context = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.ceil(window.innerWidth * dpr);
  const height = Math.ceil(window.innerHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  context.font = '11px "Departure Mono", monospace';
  context.fillStyle = "#0d0d0d";
  context.textBaseline = "top";

  const characters = ["0", "1", ".", ":", "·"];
  const cellX = 11;
  const cellY = 22;
  const columns = Math.ceil(window.innerWidth / cellX);
  const rows = Math.ceil(window.innerHeight / cellY);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const cadence = Math.floor(frame * (0.38 + hash2d(x, y, 17) * 1.2));
      if (hash2d(x, y, 4 + cadence) < 0.72) continue;
      const index = Math.floor(hash2d(x, y, 9 + cadence) * characters.length);
      context.globalAlpha = 0.42 + hash2d(x, y, 31 + cadence) * 0.58;
      context.fillText(characters[index], x * cellX, y * cellY);
    }
  }
  context.globalAlpha = 1;
}

function startGlyphNoise() {
  const noise = state.glyphNoise;
  if (noise.running) return;
  if (prefersReducedMotion()) {
    drawGlyphNoise(0);
    return;
  }

  noise.running = true;
  const loop = (now) => {
    if (!noise.running) return;
    if (!noise.paused && now - noise.lastFrame >= noise.frameInterval) {
      noise.lastFrame = now;
      noise.frame += 1;
      drawGlyphNoise(noise.frame);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function preparePointerGlitchSource() {
  const image = $("#boot-still");
  if (!image?.complete || !image.naturalWidth) return;
  const pointer = state.pointerGlitch;
  pointer.sampleCanvas = document.createElement("canvas");
  pointer.sampleCanvas.width = pointer.sampleWidth;
  pointer.sampleCanvas.height = pointer.sampleHeight;
  pointer.sampleContext = pointer.sampleCanvas.getContext("2d", { willReadFrequently: true });
  updatePointerGlitchSource(performance.now(), image, true);
}

function updatePointerGlitchSource(now, fallback = $("#boot-still"), force = false) {
  const pointer = state.pointerGlitch;
  if (!pointer.sampleContext || (!force && now - pointer.sampleUpdatedAt < 42)) return;
  const bootVideo = $("#boot-video");
  const bootIsVisible = !$("#boot-overlay")?.hidden;
  const source = bootIsVisible && bootVideo?.readyState >= 2
    ? bootVideo
    : fallback;
  const sourceWidth = source?.videoWidth || source?.naturalWidth || 0;
  const sourceHeight = source?.videoHeight || source?.naturalHeight || 0;
  if (!sourceWidth || !sourceHeight) return;

  const targetAspect = pointer.sampleWidth / pointer.sampleHeight;
  const sourceAspect = sourceWidth / sourceHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;
  if (sourceAspect > targetAspect) {
    sw = sourceHeight * targetAspect;
    sx = (sourceWidth - sw) / 2;
  } else {
    sh = sourceWidth / targetAspect;
    sy = (sourceHeight - sh) / 2;
  }

  pointer.sampleContext.drawImage(
    source,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    pointer.sampleWidth,
    pointer.sampleHeight,
  );
  pointer.samplePixels = pointer.sampleContext.getImageData(
    0,
    0,
    pointer.sampleWidth,
    pointer.sampleHeight,
  ).data;
  pointer.sampleUpdatedAt = now;
}

function resizePointerGlitchCanvas() {
  const canvas = $("#cursor-glitch");
  const context = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.ceil(window.innerWidth * dpr);
  canvas.height = Math.ceil(window.innerHeight * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function pointerGlyphText(text, tick) {
  return [...text]
    .map((character, index) => {
      if (/\s/.test(character)) return character;
      const glyph = Math.floor(hash2d(index, tick, text.length) * scrambleGlyphs.length);
      return scrambleGlyphs[glyph];
    })
    .join("");
}

function activePointerTrail(now) {
  const pointer = state.pointerGlitch;
  pointer.trail = pointer.trail.filter((point) => now - point.createdAt < pointer.trailLifetime);
  return pointer.trail.map((point) => {
    const age = clamp((now - point.createdAt) / pointer.trailLifetime);
    return {
      ...point,
      life: Math.pow(1 - age, 1.45),
      radius: 18 + point.strength * 26,
    };
  });
}

function strongestTrailPointForRect(rect, trail) {
  let strongest = null;
  let strongestScore = 0;
  trail.forEach((point) => {
    const closestX = clamp(point.x, rect.left, rect.right);
    const closestY = clamp(point.y, rect.top, rect.bottom);
    const distance = Math.hypot(point.x - closestX, point.y - closestY);
    if (distance > point.radius) return;
    const score = point.life * point.strength * (1 - distance / point.radius);
    if (score > strongestScore) {
      strongest = point;
      strongestScore = score;
    }
  });
  return strongest ? { point: strongest, score: strongestScore } : null;
}

function updatePointerGlitchTargets(now, trail = activePointerTrail(now)) {
  const tick = Math.floor(now / 48);

  $$('[data-scramble]').forEach((element) => {
    if (element.classList.contains("is-scrambling")) return;
    if (element.classList.contains("terminal-buffer__output")) return;
    const rect = element.getBoundingClientRect();
    const hit = strongestTrailPointForRect(rect, trail);
    if (!hit) return;
    const { point, score } = hit;

    element.classList.add("is-pointer-glitching");
    element.dataset.pointerGlitch = pointerGlyphText(element.textContent, tick);
    element.dataset.pointerGlitchUntil = String(now + 90);
    element.style.setProperty("--pointer-glitch-x", `${point.x - rect.left}px`);
    element.style.setProperty("--pointer-glitch-y", `${point.y - rect.top}px`);
    element.style.setProperty("--pointer-glitch-radius", `${point.radius}px`);
    element.style.setProperty("--pointer-glitch-strength", String(clamp(score * 1.8)));
  });

}

function clearExpiredPointerTargets(now, force = false) {
  $$('.is-pointer-glitching').forEach((element) => {
    const expired = Number(element.dataset.pointerGlitchUntil || 0) < now;
    if (!force && !expired) return;
    element.classList.remove("is-pointer-glitching");
    delete element.dataset.pointerGlitch;
    delete element.dataset.pointerGlitchUntil;
    element.style.removeProperty("--pointer-glitch-x");
    element.style.removeProperty("--pointer-glitch-y");
    element.style.removeProperty("--pointer-glitch-radius");
    element.style.removeProperty("--pointer-glitch-strength");
  });
}

function renderPointerGlitch(now) {
  const pointer = state.pointerGlitch;
  if (now - pointer.lastDrawFrame < pointer.frameInterval) {
    requestAnimationFrame(renderPointerGlitch);
    return;
  }
  pointer.lastDrawFrame = now;
  const canvas = $("#cursor-glitch");
  const context = canvas.getContext("2d");
  const elapsed = Math.max(1, now - pointer.lastFrame);
  pointer.lastFrame = now;

  if (now - pointer.lastMove > 55) {
    pointer.intensity *= Math.pow(0.86, elapsed / 16.67);
  }

  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  updatePointerGlitchSource(now);
  const trail = activePointerTrail(now);
  updatePointerGlitchTargets(now, trail);
  clearExpiredPointerTargets(now);

  if ((!trail.length && pointer.intensity < 0.012) || !pointer.samplePixels) {
    pointer.intensity = 0;
    pointer.running = false;
    clearExpiredPointerTargets(now, true);
    return;
  }

  const cell = 11;
  const activeCells = new Map();
  trail.forEach((point) => {
    const startX = Math.floor((point.x - point.radius) / cell) * cell;
    const endX = point.x + point.radius;
    const startY = Math.floor((point.y - point.radius) / cell) * cell;
    const endY = point.y + point.radius;
    for (let y = startY; y <= endY; y += cell) {
      for (let x = startX; x <= endX; x += cell) {
        const distance = Math.hypot(x - point.x, y - point.y);
        if (distance > point.radius) continue;
        const strength = point.life * point.strength * (1 - distance / point.radius);
        const key = `${x},${y}`;
        if (!activeCells.has(key) || activeCells.get(key).strength < strength) {
          activeCells.set(key, { x, y, strength, point });
        }
      }
    }
  });

  const palette = " .:-=+*#%@";
  context.font = '11px "Departure Mono", monospace';
  context.textBaseline = "top";

  activeCells.forEach(({ x, y, strength, point }) => {
      const localStrength = clamp(strength * 1.45);
      const noise = hash2d(Math.floor(x / cell), Math.floor(y / cell), Math.floor(now / 48));
      if (noise > 0.22 + localStrength * 0.38) return;

      const sampleX = clamp(
        Math.floor((x / window.innerWidth) * pointer.sampleWidth),
        0,
        pointer.sampleWidth - 1,
      );
      const sampleY = clamp(
        Math.floor((y / window.innerHeight) * pointer.sampleHeight),
        0,
        pointer.sampleHeight - 1,
      );
      const sampleIndex = (sampleY * pointer.sampleWidth + sampleX) * 4;
      const r = pointer.samplePixels[sampleIndex];
      const g = pointer.samplePixels[sampleIndex + 1];
      const b = pointer.samplePixels[sampleIndex + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const baseGlyph = Math.floor((luma / 256) * palette.length);
      const scrambleOffset = Math.round((noise - 0.5) * 5 * localStrength);
      const glyph = palette[clamp(baseGlyph + scrambleOffset, 0, palette.length - 1)];
      const alpha = clamp(localStrength * 1.25);
      const jitterX = (noise - 0.5) * point.strength * 14;
      context.fillStyle = `rgb(255 255 255 / ${clamp(alpha * 0.24)})`;
      context.fillRect(x - 1, y - 1, cell + 2, cell + 2);
      context.fillStyle = `rgb(255 255 255 / ${alpha})`;
      context.fillText(glyph, x + jitterX, y);
  });

  requestAnimationFrame(renderPointerGlitch);
}

function handlePointerGlitch(event) {
  if (prefersReducedMotion()) return;
  const pointer = state.pointerGlitch;
  const now = performance.now();
  const elapsed = Math.max(8, now - pointer.previousTime);
  const distance = Math.hypot(event.clientX - pointer.previousX, event.clientY - pointer.previousY);
  const hasPreviousPoint = pointer.previousTime > 0;
  const speed = hasPreviousPoint ? distance / elapsed : 0;
  const strength = clamp(0.22 + speed * 0.82);

  if (hasPreviousPoint) {
    const steps = Math.max(1, Math.ceil(distance / 22));
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      pointer.trail.push({
        x: pointer.previousX + (event.clientX - pointer.previousX) * progress,
        y: pointer.previousY + (event.clientY - pointer.previousY) * progress,
        createdAt: now - (1 - progress) * Math.min(elapsed, 32),
        strength,
      });
    }
    pointer.trail = pointer.trail.slice(-22);
  } else {
    pointer.trail.push({ x: event.clientX, y: event.clientY, createdAt: now, strength: 0.35 });
  }

  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.previousX = event.clientX;
  pointer.previousY = event.clientY;
  pointer.previousTime = now;
  pointer.lastMove = now;
  pointer.intensity = Math.max(pointer.intensity, strength);

  if (!pointer.running) {
    pointer.running = true;
    pointer.lastFrame = now;
    requestAnimationFrame(renderPointerGlitch);
  }
}

const glyphCursorInteractiveSelector = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[data-drag-handle]",
].join(",");

function restoreGlyphCursor() {
  const cursor = $("#glyph-cursor");
  const cursorState = state.glyphCursor;
  if (cursorState.actionLabel) {
    cursor.textContent = cursorState.actionLabel;
    cursor.classList.remove("is-interactive", "is-animating");
    cursor.classList.add("is-fullscreen-close");
    return;
  }
  cursor.textContent = "↖";
  cursor.classList.remove("is-fullscreen-close");
  cursor.classList.toggle("is-interactive", cursorState.interactive);
}

async function showGlyphCursorMessage(message, destination, hold = 900) {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  const cursorState = state.glyphCursor;
  const token = cursorState.transientToken + 1;
  cursorState.transientToken = token;
  $(".glyph-cursor-flight")?.remove();

  const { x, y } = state.pointerGlitch;
  const flight = document.createElement("span");
  flight.className = "glyph-cursor-flight";
  flight.setAttribute("aria-hidden", "true");
  flight.style.position = "fixed";
  flight.style.left = `${Math.max(0, x + 16)}px`;
  flight.style.top = `${Math.max(0, y + 16)}px`;
  document.body.append(flight);

  for (let index = 1; index <= message.length; index += 1) {
    if (cursorState.transientToken !== token) {
      flight.remove();
      return;
    }
    flight.textContent = message.slice(0, index);
    await wait(42);
  }

  await wait(hold);
  if (cursorState.transientToken !== token) {
    flight.remove();
    return;
  }
  const targetRect = destination?.getBoundingClientRect();
  if (!targetRect) {
    flight.remove();
    return;
  }
  const flightRect = flight.getBoundingClientRect();
  const targetX = targetRect.left + targetRect.width / 2 - flightRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2 - flightRect.height / 2;
  const animation = flight.animate([
    { left: `${flightRect.left}px`, top: `${flightRect.top}px`, opacity: 1, transform: "scale(1)" },
    { left: `${targetX}px`, top: `${targetY}px`, opacity: 1, transform: "scale(0.82)" },
  ], {
    duration: 760,
    easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    fill: "forwards",
  });
  await animation.finished.catch(() => {});
  if (cursorState.transientToken !== token) {
    flight.remove();
    return;
  }
  await wait(1200);
  const fade = flight.animate([
    { opacity: 1, transform: "scale(0.82)" },
    { opacity: 0, transform: "scale(0.82)" },
  ], {
    duration: 280,
    easing: "steps(4, end)",
    fill: "forwards",
  });
  await fade.finished.catch(() => {});
  flight.remove();
}

function updateGlyphCursor(event) {
  const cursor = $("#glyph-cursor");
  if (!cursor || !window.matchMedia("(pointer: fine)").matches) return;
  const fullscreenTarget = event.target.closest?.(".project-window[data-layout='media-fullscreen']:not([data-closing='true']) .project-stage");
  const reelTarget = event.target.closest?.("#grid-logo-slot, .content-block__media--fullscreen-trigger");
  const cursorState = state.glyphCursor;
  cursorState.fullscreenClose = Boolean(fullscreenTarget);
  const fullscreenAction = event.target.closest?.("[data-fullscreen-action]")?.dataset.fullscreenAction;
  const contextualLabel = fullscreenAction === "previous"
    ? "← PREVIOUS"
    : fullscreenAction === "next"
      ? "NEXT →"
      : fullscreenAction === "first"
        ? "FIRST FILE"
        : fullscreenTarget
          ? "↰ CLOSE"
          : reelTarget
            ? "OPEN REEL"
            : "";
  cursorState.actionLabel = contextualLabel;
  if (cursorState.actionLabel) {
    cursorState.animationToken += 1;
    cursorState.animating = false;
    cursorState.interactive = false;
    const badgeWidth = 110;
    const badgeHeight = 44;
    const x = event.clientX > window.innerWidth - badgeWidth - 16
      ? event.clientX - badgeWidth
      : event.clientX + 16;
    const y = event.clientY > window.innerHeight - badgeHeight - 16
      ? event.clientY - badgeHeight
      : event.clientY + 16;
    cursor.style.left = `${Math.max(0, x)}px`;
    cursor.style.top = `${Math.max(0, y)}px`;
  } else {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursorState.interactive = Boolean(event.target.closest?.(glyphCursorInteractiveSelector));
  }
  cursor.classList.add("is-visible");
  if (!cursorState.animating) restoreGlyphCursor();
}

function refreshGlyphCursorAtPointer({ forceFullscreen = false } = {}) {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  const { x, y } = state.pointerGlitch;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return;
  const fullscreenStage = forceFullscreen
    ? $(".project-window[data-layout='media-fullscreen']:not([data-closing='true']) .project-stage")
    : null;
  const target = document.elementFromPoint(x, y) || fullscreenStage;
  if (!target) return;
  updateGlyphCursor({ target, clientX: x, clientY: y });
}

async function animateGlyphCursor() {
  const cursor = $("#glyph-cursor");
  if (!cursor || !window.matchMedia("(pointer: fine)").matches) return;
  const cursorState = state.glyphCursor;
  if (cursorState.actionLabel) return;
  const token = cursorState.animationToken + 1;
  cursorState.animationToken = token;
  cursorState.animating = true;
  cursor.classList.add("is-animating");

  for (const glyph of ["▓", "▒", "░", "▘", "▀", "▛", "█"]) {
    if (token !== cursorState.animationToken) return;
    cursor.textContent = glyph;
    await wait(46);
  }
  await wait(72);
  if (token !== cursorState.animationToken) return;
  cursorState.animating = false;
  cursor.classList.remove("is-animating");
  restoreGlyphCursor();
}

function updateMobileProjectInset() {
  const header = $(".site-header");
  if (!header) return;
  const headerBottom = header.getBoundingClientRect().bottom;
  const snappedTop = Math.ceil((headerBottom + 11) / 22) * 22;
  document.documentElement.style.setProperty("--mobile-project-top", `${snappedTop}px`);
}

function fitProjectWindowToWorkspace(windowElement, { cascade = false } = {}) {
  if (
    !windowElement?.isConnected
    || window.innerWidth <= 720
    || windowElement.dataset.layout === "media-fullscreen"
  ) return;

  const workspace = $("#workspace");
  const workspaceRect = workspace.getBoundingClientRect();
  if (
    windowElement.dataset.layout === "folder"
    && windowElement.dataset.windowMode !== "legacy-compact"
  ) {
    windowElement.style.left = "22px";
    windowElement.style.top = "22px";
    return;
  }
  const windowRect = windowElement.getBoundingClientRect();
  const computed = getComputedStyle(windowElement);
  const currentLeft = Number.parseFloat(computed.left) || 0;
  const currentTop = Number.parseFloat(computed.top) || 0;
  const maxLeft = Math.max(0, workspaceRect.width - windowRect.width);
  const maxTop = Math.max(0, workspaceRect.height - windowRect.height);
  const openWindows = $$(".project-window:not([data-layout='media-fullscreen'])");
  const windowIndex = Math.max(0, openWindows.indexOf(windowElement));
  const availableSlots = Math.max(1, Math.floor(Math.min(maxLeft / 66, maxTop / 44)) + 1);
  const cascadeSlot = windowIndex % availableSlots;
  const preferredLeft = cascade ? 22 + cascadeSlot * 66 : currentLeft;
  const preferredTop = cascade ? 22 + cascadeSlot * 44 : currentTop;

  windowElement.style.left = `${Math.round(clamp(preferredLeft, 0, maxLeft) / 11) * 11}px`;
  windowElement.style.top = `${Math.round(clamp(preferredTop, 0, maxTop) / 22) * 22}px`;
}

const windowEdgeFxTokens = new WeakMap();

function ensureWindowEdgeFx(windowElement) {
  let effect = $(".window-edge-fx", windowElement);
  if (effect) return effect;
  effect = document.createElement("div");
  effect.className = "window-edge-fx";
  effect.setAttribute("aria-hidden", "true");
  ["top", "right", "bottom", "left"].forEach((edge) => {
    const glyphs = document.createElement("span");
    glyphs.className = "window-edge-fx__glyphs";
    glyphs.dataset.edge = edge;
    effect.append(glyphs);
  });
  windowElement.append(effect);
  return effect;
}

function playWindowEdgeGlitch(windowElement, duration = 680) {
  const effect = ensureWindowEdgeFx(windowElement);
  if (animationsDisabled) return;
  const token = (windowEdgeFxTokens.get(effect) || 0) + 1;
  windowEdgeFxTokens.set(effect, token);
  effect.classList.remove("is-glitching");
  void effect.offsetWidth;
  effect.classList.add("is-glitching");
  const rect = effect.getBoundingClientRect();
  const edgeLengths = {
    top: Math.max(1, Math.ceil(rect.width / 11)),
    right: Math.max(1, Math.ceil(rect.height / 11)),
    bottom: Math.max(1, Math.ceil(rect.width / 11)),
    left: Math.max(1, Math.ceil(rect.height / 11)),
  };
  const started = performance.now();
  let previousTick = -1;

  const renderEdge = (element, edge, tick, progress) => {
    const vertical = edge === "left" || edge === "right";
    const salt = ["top", "right", "bottom", "left"].indexOf(edge) + 1;
    const characters = Array.from({ length: edgeLengths[edge] }, (_, index) => {
      if (hash2d(index, salt, 941) < progress) return " ";
      const glyphIndex = Math.floor(hash2d(index, tick + salt * 13, 947) * scrambleGlyphs.length);
      return scrambleGlyphs[glyphIndex];
    });
    element.textContent = vertical ? characters.join("\n") : characters.join("");
  };

  const frame = (now) => {
    if (windowEdgeFxTokens.get(effect) !== token) return;
    const progress = clamp((now - started) / duration);
    const tick = Math.floor((now - started) / 42);
    if (tick !== previousTick || progress === 1) {
      previousTick = tick;
      $$(".window-edge-fx__glyphs", effect).forEach((element) => {
        renderEdge(element, element.dataset.edge, tick, progress);
      });
    }
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      effect.classList.remove("is-glitching");
      $$(".window-edge-fx__glyphs", effect).forEach((element) => { element.textContent = ""; });
    }
  };
  requestAnimationFrame(frame);
}

function refreshWindowEdges() {
  $$('[data-window]').forEach(ensureWindowEdgeFx);
}

function syncWindowFocusLayer(windowElement = null) {
  let layer = $("#window-focus-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "window-focus-layer";
    layer.className = "window-focus-layer";
    layer.setAttribute("aria-hidden", "true");
    $("#site").append(layer);
  }

  const candidate = windowElement?.isConnected
    ? windowElement
    : $('[data-window].is-active:not([hidden]):not([data-closing="true"])');
  const activeWindow = candidate?.matches('[data-project-window], [data-os-open="true"]')
    ? candidate
    : null;
  if (!activeWindow) {
    layer.hidden = true;
    return;
  }

  const activeLayer = Number(activeWindow.style.zIndex || getComputedStyle(activeWindow).zIndex || 10);
  layer.style.zIndex = String(activeLayer - 1);
  layer.hidden = false;
}

function bringToFront(windowElement) {
  state.zIndex += 2;
  $$('[data-window].is-active').forEach((item) => item.classList.remove("is-active"));
  const layerBase = windowElement.matches('.project-window, [data-os-open="true"]') ? 3000 : 0;
  windowElement.style.zIndex = layerBase + state.zIndex;
  windowElement.classList.add("is-active");
  syncWindowFocusLayer(windowElement);
}

function installWindowBehavior(windowElement) {
  ensureWindowEdgeFx(windowElement);
  windowElement.addEventListener("pointerdown", () => bringToFront(windowElement));
  const handle = $("[data-drag-handle]", windowElement);
  if (!handle) return;

  handle.addEventListener("pointerdown", (event) => {
    if (document.body.dataset.view !== "os" || window.innerWidth <= 720) return;
    if (windowElement.matches('.window--monitor[data-os-open="true"]')) return;
    if (event.target.closest("button")) return;

    bringToFront(windowElement);
    const workspace = $("#workspace");
    const workspaceRect = workspace.getBoundingClientRect();
    const windowRect = windowElement.getBoundingClientRect();
    const originX = event.clientX;
    const originY = event.clientY;
    const startLeft = windowRect.left - workspaceRect.left;
    const startTop = windowRect.top - workspaceRect.top;
    handle.setPointerCapture(event.pointerId);

    const move = (moveEvent) => {
      const left = clamp(
        startLeft + moveEvent.clientX - originX,
        0,
        Math.max(0, workspaceRect.width - windowRect.width),
      );
      const top = clamp(
        startTop + moveEvent.clientY - originY,
        0,
        Math.max(0, workspaceRect.height - windowRect.height),
      );
      windowElement.style.left = `${Math.round(left / 11) * 11}px`;
      windowElement.style.top = `${Math.round(top / 22) * 22}px`;
    };

    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      ensureWindowEdgeFx(windowElement);
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  });
}

function targetRectsForBoot() {
  return $$('[data-window]:not([data-project-window])').map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  });
}

async function setBootProgress(value, label, duration = 180) {
  const progressElement = $("#boot-progress");
  const from = Number(progressElement.value) / 100;
  await animateValue(from, value, duration, (current) => {
    renderBootProgress(current, label);
  });
}

function renderBootProgress(value, label) {
  const progressElement = $("#boot-progress");
  const percent = Math.round(value * 100);
  progressElement.value = percent;
  progressElement.textContent = `${percent}%`;
  $("#boot-bar").textContent = renderGlyphBar(value, 25);
  $("#boot-label").textContent = label;
}

function preloadThumbnailAsset({ source, type }) {
  return new Promise((resolve) => {
    const media = document.createElement(type === "video" ? "video" : "img");
    const readyEvent = type === "video" ? "loadeddata" : "load";
    let settled = false;
    const finish = async (loaded) => {
      if (settled) return;
      settled = true;
      media.removeEventListener(readyEvent, onReady);
      media.removeEventListener("error", onError);
      if (loaded && media instanceof HTMLImageElement && media.decode) {
        await media.decode().catch(() => {});
      }
      resolve({ source, loaded });
    };
    const onReady = () => finish(true);
    const onError = () => finish(false);

    media.addEventListener(readyEvent, onReady, { once: true });
    media.addEventListener("error", onError, { once: true });
    if (media instanceof HTMLVideoElement) {
      media.muted = true;
      media.preload = "auto";
    } else {
      media.decoding = "async";
    }
    media.src = source;
    if (media instanceof HTMLVideoElement) media.load();
  });
}

async function preloadProjectThumbnails(fromProgress = 0.31, toProgress = 0.58) {
  const uniqueAssets = new Map();
  projectChildren(null).forEach((project) => {
    const usesPoster = project.thumbnailType === "video" && project.posterFrame;
    const source = usesPoster ? project.posterFrame : project.thumbnail;
    if (!source) return;
    const type = usesPoster ? "image" : project.thumbnailType;
    uniqueAssets.set(`${type}:${source}`, { source, type });
  });

  const assets = [...uniqueAssets.values()];
  if (!assets.length) return [];
  let settled = 0;
  renderBootProgress(fromProgress, `LOADING PROJECT THUMBNAILS 0/${assets.length}`);
  const results = await Promise.all(assets.map(async (asset) => {
    const result = await preloadThumbnailAsset(asset);
    settled += 1;
    const progress = fromProgress + (toProgress - fromProgress) * (settled / assets.length);
    renderBootProgress(progress, `LOADING PROJECT THUMBNAILS ${settled}/${assets.length}`);
    return result;
  }));
  const failures = results.filter((result) => !result.loaded);
  if (failures.length) console.warn("Some project thumbnails failed to preload.", failures.map(({ source }) => source));
  return results;
}

async function dismissBootPanel(panel, reducedMotion = false) {
  if (!panel || panel.hidden) return;
  if (reducedMotion) {
    panel.hidden = true;
    return;
  }

  panel.style.pointerEvents = "none";
  const field = createWindowTransitionField(panel, 0);
  await animateWindowTransitionField(field, 0, 1, 260);
  panel.classList.add("is-glyph-dismissed");
  await animateWindowTransitionField(field, 1, 0, 180);
  panel.hidden = true;
  field.canvas.remove();
  panel.classList.remove("is-glyph-dismissed");
  panel.style.removeProperty("pointer-events");
}

function resetBootLogoStage(overlay, stage, canvas) {
  stage.getAnimations().forEach((animation) => animation.cancel());
  if (stage.parentElement !== overlay) overlay.insertBefore(stage, canvas);
  stage.className = "boot-logo-stage";
  stage.removeAttribute("style");
}

function dockBootLogo(stage, slot) {
  if (!stage || !slot) return;
  slot.append(stage);
  stage.className = "boot-logo-stage is-visible is-docked";
  stage.removeAttribute("style");
}

async function animateBootLogoToSlot(stage, slot, duration = 800) {
  if (!stage || !slot || !duration) {
    dockBootLogo(stage, slot);
    return;
  }

  const start = stage.getBoundingClientRect();
  const target = slot.getBoundingClientRect();
  if (!target.width || !target.height) {
    dockBootLogo(stage, slot);
    return;
  }

  const logoVideo = $("video", stage);
  const widthLimited = window.innerWidth / window.innerHeight <= 975 / 753;
  const startMaskSize = widthLimited ? "92% auto" : "auto 88%";
  const targetMaskSize = widthLimited ? "100% auto" : "auto 100%";

  const animation = stage.animate(
    [
      {
        left: `${start.left}px`,
        top: `${start.top}px`,
        width: `${start.width}px`,
        height: `${start.height}px`,
      },
      {
        left: `${target.left}px`,
        top: `${target.top}px`,
        width: `${target.width}px`,
        height: `${target.height}px`,
      },
    ],
    {
      duration,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "forwards",
    },
  );
  const maskAnimation = logoVideo?.animate(
    [
      { webkitMaskSize: startMaskSize, maskSize: startMaskSize },
      { webkitMaskSize: targetMaskSize, maskSize: targetMaskSize },
    ],
    {
      duration,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      fill: "forwards",
    },
  );
  await Promise.all([
    animation.finished.catch(() => {}),
    maskAnimation?.finished.catch(() => {}),
  ]);
  dockBootLogo(stage, slot);
  animation.cancel();
  maskAnimation?.cancel();
}

function finishBoot(runId) {
  if (runId !== state.bootRun) return;
  const overlay = $("#boot-overlay");
  const site = $("#site");
  state.bootRenderer?.stop();
  state.bootRenderer = null;
  const bootVideo = $("#boot-video");
  bootVideo.pause();
  bootVideo.classList.remove("is-raw-visible");
  bootVideo.getAnimations().forEach((animation) => animation.cancel());
  const logoStage = $("#boot-logo-stage");
  const logoVideo = $("#boot-logo-video");
  attachDeferredMedia(logoVideo);
  if (!$("#grid-logo-slot").contains(logoStage)) {
    if (bootVideo.duration) logoVideo.currentTime = bootVideo.currentTime % bootVideo.duration;
    logoVideo.play().catch(() => {});
    dockBootLogo(logoStage, $("#grid-logo-slot"));
  }
  overlay.hidden = true;
  overlay.classList.add("is-complete");
  overlay.style.background = "";
  const panel = $(".boot-panel", overlay);
  $(".window-transition-glyphs", panel)?.remove();
  panel.classList.remove("is-glyph-dismissed");
  panel.style.removeProperty("pointer-events");
  panel.hidden = false;
  site.inert = false;
  site.removeAttribute("aria-hidden");
  site.classList.remove("is-content-masked", "is-fake-ui", "is-interface-scrambling");
  cleanupMediaScrambles();
  $$('[data-media-src]:not(#boot-logo-video)', overlay).forEach((element) => {
    detachDeferredMedia(element, { force: true });
  });
  refreshWindowEdges();
}

async function runBoot() {
  state.bootRun += 1;
  const runId = state.bootRun;
  const overlay = $("#boot-overlay");
  const site = $("#site");
  const video = $("#boot-video");
  const still = $("#boot-still");
  const connectionFrames = $$('[data-connect-frame]');
  const logo = $("#boot-logo");
  const canvas = $("#boot-canvas");
  const logoStage = $("#boot-logo-stage");
  const logoVideo = $("#boot-logo-video");
  const logoSlot = $("#grid-logo-slot");
  const panel = $(".boot-panel", overlay);
  const reducedMotion = prefersReducedMotion();

  $$('[data-media-src]', overlay).forEach(attachDeferredMedia);

  state.bootRenderer?.stop();
  site.classList.remove("cheat-direction-ready");
  resetBootLogoStage(overlay, logoStage, canvas);
  logoVideo.pause();
  logoVideo.currentTime = 0;
  canvas.getAnimations().forEach((animation) => animation.cancel());
  canvas.style.opacity = "1";
  overlay.hidden = false;
  overlay.classList.remove("is-complete");
  overlay.style.background = "#000000";
  $(".window-transition-glyphs", panel)?.remove();
  panel.classList.remove("is-glyph-dismissed");
  panel.style.removeProperty("pointer-events");
  panel.hidden = false;
  markScrambleTargets(overlay);
  site.classList.remove("is-content-masked", "is-fake-ui", "is-interface-scrambling");
  cleanupMediaScrambles();
  site.inert = true;
  site.setAttribute("aria-hidden", "true");
  $("#boot-progress").value = 0;
  $("#boot-bar").textContent = renderGlyphBar(0, 25);
  video.currentTime = 0;

  await setBootProgress(0.12, "WAKING UP THE DOCUMENT", reducedMotion ? 0 : 40);
  await document.fonts.load('22px "Departure Mono"');
  if (runId !== state.bootRun) return;
  await setBootProgress(0.31, "MEASURING CHARACTER LATTICE", reducedMotion ? 0 : 40);

  await preloadProjectThumbnails();
  if (runId !== state.bootRun) return;

  if (!still.complete) await waitForEvent(still, "load", 2500);
  if (still.decode) await still.decode().catch(() => {});
  preparePointerGlitchSource();
  await Promise.all(
    connectionFrames.map(async (frame) => {
      if (!frame.complete) await waitForEvent(frame, "load", 2500);
      if (frame.decode) await frame.decode().catch(() => {});
    }),
  );
  if (!logo.complete) await waitForEvent(logo, "load", 2500);
  if (logo.decode) await logo.decode().catch(() => {});
  if (video.readyState < 2) await waitForEvent(video, "loadeddata", 2500);
  if (logoVideo.readyState < 2) await waitForEvent(logoVideo, "loadeddata", 2500);
  if (runId !== state.bootRun) return;
  await setBootProgress(0.62, "DECODING VIDEO FRAME", reducedMotion ? 0 : 60);

  state.bootRenderer = new AsciiMediaRenderer(canvas, still, {
    fontSize: 22,
    lineHeight: 22,
    fps: 24,
    monochrome: false,
    contrast: 1.35,
    colorGain: 1.12,
    maskImage: logo,
  });
  state.bootRenderer.setReveal(1);
  state.bootRenderer.start();
  refreshWindowEdges();

  if (reducedMotion) {
    finishBoot(runId);
    return;
  }

  const stillReveal = animateValue(1, 0, 1500, (value) => state.bootRenderer?.setReveal(value));
  const progressFinish = setBootProgress(1, "NEGOTIATING THREE-FRAME HANDSHAKE", 1500);
  for (let connectionTick = 0; connectionTick < 15; connectionTick += 1) {
    state.bootRenderer?.setSource(connectionFrames[connectionTick % connectionFrames.length]);
    await wait(100);
  }
  await Promise.all([stillReveal, progressFinish]);
  if (runId !== state.bootRun) return;
  await dismissBootPanel(panel, reducedMotion);
  if (runId !== state.bootRun) return;

  video.currentTime = 0;
  await video.play().catch(() => {});
  state.bootRenderer?.setSource(video);
  state.bootRenderer?.setReveal(0);
  await wait(1000);
  if (runId !== state.bootRun) return;

  state.bootRenderer?.setMediaScrambleProgress(0.62);
  state.bootRenderer?.setLogoContainProgress(0);
  await Promise.all([
    animateValue(0, 1, 820, (value) => state.bootRenderer?.setLogoContainProgress(value)),
    animateValue(0.62, 0.82, 820, (value) => state.bootRenderer?.setMediaScrambleProgress(value)),
  ]);
  state.bootRenderer?.setLogoContainProgress(1);
  state.bootRenderer?.setMediaScrambleProgress(0.78);
  await wait(160);
  if (runId !== state.bootRun) return;

  logoVideo.currentTime = video.currentTime;
  await logoVideo.play().catch(() => {});
  logoStage.classList.add("is-visible");
  state.bootRenderer?.setCellDissolveProgress(0);
  const logoReveal = logoStage.animate(
    [
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: 1 },
    ],
    { duration: 720, easing: "steps(12, end)", fill: "both" },
  );
  await Promise.all([
    animateValue(0.78, 1, 620, (value) => state.bootRenderer?.setMediaScrambleProgress(value)),
    animateValue(0, 1, 720, (value) => state.bootRenderer?.setCellDissolveProgress(value)),
    logoReveal.finished.catch(() => {}),
  ]);
  state.bootRenderer?.setMediaScrambleProgress(null);
  logoReveal.cancel();
  if (runId !== state.bootRun) return;

  refreshWindowEdges();
  site.classList.add("is-interface-scrambling");
  site.inert = false;
  site.removeAttribute("aria-hidden");

  const exactInterface = runInterfaceSplitFlap(site);
  const mediaInterface = Promise.all(
    $$('[data-glitch-media]:not([data-scroll-media-reveal])', site)
      .map((element) => scrambleMediaElement(element)),
  );
  overlay.style.background = "transparent";
  const logoDock = animateBootLogoToSlot(logoStage, logoSlot, 800);
  await Promise.all([exactInterface, mediaInterface, logoDock]);
  if (runId !== state.bootRun) return;
  site.classList.remove("is-interface-scrambling");
  finishBoot(runId);
}

async function loadProjectSource(windowElement, config) {
  const video = $("[data-project-video]", windowElement);
  const image = $("[data-project-image]", windowElement);

  if (config.sourceType === "vimeo") {
    const source = vimeoEmbedUrl(config.source, { autoplay: true, loop: true });
    if (!source) return null;
    const iframe = document.createElement("iframe");
    iframe.className = "source-media source-media--embed";
    iframe.dataset.projectEmbed = "";
    iframe.src = source;
    iframe.title = config.heading || config.title || "Vimeo reel";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allow = "autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share";
    iframe.allowFullscreen = true;
    $(".project-stage", windowElement).append(iframe);
    return iframe;
  }

  if (config.sourceType === "video") {
    video.src = config.source;
    video.load();
    if (video.readyState < 2) await waitForEvent(video, "loadeddata", 3000);
    await video.play().catch(() => {});
    return video;
  }

  image.src = config.source;
  if (!image.complete) await waitForEvent(image, "load", 3000);
  if (image.decode) await image.decode().catch(() => {});
  return image;
}

function renderFullscreenMediaNavigation(windowElement) {
  if (windowElement.dataset.layout !== "media-fullscreen") return;
  const projectId = windowElement.dataset.projectWindow;
  if (projectConfig(projectId)?.sourceType === "vimeo") {
    $("[data-fullscreen-navigation]", windowElement)?.remove();
    return;
  }
  const mediaSet = fullscreenMediaSet(projectId);
  const index = Math.max(0, mediaSet.findIndex((project) => project.id === projectId));
  const stage = $(".project-stage", windowElement);
  let navigation = $("[data-fullscreen-navigation]", stage);

  if (!navigation) {
    navigation = document.createElement("div");
    navigation.className = "fullscreen-media-navigation";
    navigation.dataset.fullscreenNavigation = "";

    const previous = document.createElement("div");
    previous.className = "fullscreen-media-navigation__zone fullscreen-media-navigation__zone--previous";
    previous.dataset.fullscreenDirection = "previous";
    previous.setAttribute("role", "button");
    previous.tabIndex = 0;

    const forward = document.createElement("div");
    forward.className = "fullscreen-media-navigation__zone fullscreen-media-navigation__zone--forward";
    forward.dataset.fullscreenDirection = "forward";
    forward.setAttribute("role", "button");
    forward.tabIndex = 0;

    navigation.append(previous, forward);
    stage.append(navigation);
  }

  const previous = $("[data-fullscreen-direction='previous']", navigation);
  const forward = $("[data-fullscreen-direction='forward']", navigation);
  const isSingle = mediaSet.length === 1;
  const hasPrevious = index > 0;
  const hasNext = index < mediaSet.length - 1;
  navigation.classList.toggle("is-single", isSingle);
  previous.hidden = isSingle;
  previous.tabIndex = hasPrevious ? 0 : -1;
  previous.dataset.fullscreenAction = hasPrevious ? "previous" : "first";
  previous.setAttribute("aria-disabled", String(!hasPrevious));
  previous.setAttribute("aria-label", hasPrevious ? "Previous file" : "First file in set");
  forward.dataset.fullscreenAction = !isSingle && hasNext ? "next" : "close";
  forward.setAttribute("aria-label", !isSingle && hasNext ? "Next file" : "Close media viewer");
  const counter = $("[data-fullscreen-count]", windowElement);
  counter.hidden = false;
  counter.textContent = `[${index + 1}/${mediaSet.length}]`;
}

async function navigateFullscreenMedia(windowElement, direction) {
  if (!windowElement?.isConnected || windowElement.dataset.mediaNavigating === "true") return;
  const projectId = windowElement.dataset.projectWindow;
  const mediaSet = fullscreenMediaSet(projectId);
  const index = mediaSet.findIndex((project) => project.id === projectId);
  const targetIndex = direction === "previous" ? index - 1 : index + 1;
  if (targetIndex < 0) return;
  if (targetIndex >= mediaSet.length) {
    await closeProjectWindow(windowElement);
    return;
  }

  const targetId = mediaSet[targetIndex].id;
  windowElement.dataset.mediaNavigating = "true";
  const config = await loadProjectPage(targetId);
  if (!config || !windowElement.isConnected) {
    delete windowElement.dataset.mediaNavigating;
    return;
  }

  const oldSource = $(".source-media.is-output", windowElement);
  oldSource?.classList.remove("is-output");
  if (oldSource instanceof HTMLVideoElement) oldSource.pause();

  windowElement.dataset.projectWindow = targetId;
  $("[data-project-title]", windowElement).textContent = config.title;
  const stage = $(".project-stage", windowElement);
  stage.setAttribute("aria-label", `${config.heading || config.title} media viewer`);

  if (config.sourceType === "video") {
    $("[data-project-image]", windowElement).removeAttribute("src");
  } else {
    const video = $("[data-project-video]", windowElement);
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  const source = await loadProjectSource(windowElement, config);
  if (!windowElement.isConnected || windowElement.dataset.projectWindow !== targetId) return;
  source.classList.add("is-output");
  if (!prefersReducedMotion()) {
    source.animate(
      [{ opacity: 0, filter: "contrast(1.8)" }, { opacity: 1, filter: "contrast(1)" }],
      { duration: 240, easing: "steps(6, end)" },
    );
  }
  renderFullscreenMediaNavigation(windowElement);
  updateProjectHistory(targetId, "push");
  unloadProjectPage(projectId);
  delete windowElement.dataset.mediaNavigating;
  refreshGlyphCursorAtPointer({ forceFullscreen: true });
}

function activateFullscreenMediaControl(control) {
  if (!control) return;
  const windowElement = control.closest(".project-window");
  const action = control.dataset.fullscreenAction;
  if (action === "previous") navigateFullscreenMedia(windowElement, "previous");
  else if (action === "next") navigateFullscreenMedia(windowElement, "next");
  else if (action === "close") closeProjectWindow(windowElement);
}

async function setProjectProgress(windowElement, value, label, duration = 150) {
  const bar = $("[data-project-bar]", windowElement);
  const status = $("[data-project-status]", windowElement);
  const previous = Number(windowElement.dataset.progress || 0);
  status.textContent = label;
  await animateValue(previous, value, duration, (current) => {
    windowElement.dataset.progress = String(current);
    bar.textContent = renderGlyphBar(current, 18);
  });
}

function renderProjectChildren(container, projectId) {
  const children = visibleProjectChildren(projectId);
  container.replaceChildren();
  container.hidden = children.length === 0;
  children.forEach((child) => {
    const childLabel = projectLabel(child);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "child-project";
    button.dataset.openProject = child.id;
    button.dataset.staticControl = "";
    button.setAttribute("aria-label", `Open ${childLabel}`);
    button.title = childLabel;
    const icon = createProjectVisual(child, "child");
    const overlay = document.createElement("span");
    overlay.className = "project-tile__overlay child-project__overlay";
    const overlayIcon = document.createElement("span");
    overlayIcon.className = "project-tile__folder project-pixel";
    overlayIcon.append(createPixelIcon(projectHasChildren(child.id) ? "folder-open" : "folder"));
    const overlayName = document.createElement("strong");
    overlayName.className = "project-tile__name control-label";
    overlayName.textContent = child.heading || childLabel;
    const overlayMeta = document.createElement("small");
    overlayMeta.className = "project-tile__meta";
    overlayMeta.textContent = [child.category, child.period].filter(Boolean).join(" / ");
    overlay.append(overlayIcon, overlayName, overlayMeta);

    button.append(icon, overlay);
    container.append(button);
    if (icon instanceof HTMLVideoElement) {
      icon.addEventListener("canplay", () => icon.play().catch(() => {}));
    }
    attachDeferredMedia(icon);
  });
}

function youtubeVideoId(value) {
  const source = String(value || "").trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(source)) return source;

  try {
    const url = new URL(/^https?:\/\//i.test(source) ? source : `https://${source}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
    if (host !== "youtube.com" && !host.endsWith(".youtube.com") && host !== "youtube-nocookie.com") return "";
    if (url.pathname === "/watch") return url.searchParams.get("v") || "";
    const [route, videoId] = url.pathname.split("/").filter(Boolean);
    return ["embed", "shorts", "live"].includes(route) ? videoId || "" : "";
  } catch {
    return "";
  }
}

function vimeoVideoId(value) {
  const source = String(value || "").trim();
  if (/^\d+$/.test(source)) return source;

  try {
    const url = new URL(/^https?:\/\//i.test(source) ? source : `https://${source}`);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return "";
    const parts = url.pathname.split("/").filter(Boolean);
    return [...parts].reverse().find((part) => /^\d+$/.test(part)) || "";
  } catch {
    return "";
  }
}

function vimeoEmbedUrl(value, { autoplay = false, loop = false } = {}) {
  const videoId = vimeoVideoId(value);
  if (!videoId) return "";
  const params = new URLSearchParams({
    autoplay: autoplay ? "1" : "0",
    loop: loop ? "1" : "0",
    muted: "0",
    title: "0",
    byline: "0",
    portrait: "0",
    dnt: "1",
  });
  return `https://player.vimeo.com/video/${videoId}?${params}`;
}

function fullscreenProjectForBlock(block) {
  if (!block || !["image", "video"].includes(block.type)) return null;
  return Object.values(projectData).find((project) => (
    project.layout === "media-fullscreen"
    && ((block.mediaRef && project.mediaRef === block.mediaRef) || (!block.mediaRef && project.source === block.source))
  )) || null;
}

function makeCreativeFullscreenTrigger(media, block) {
  const project = fullscreenProjectForBlock(block);
  if (!project) return;
  media.dataset.openProject = project.id;
  media.classList.add("content-block__media--fullscreen-trigger");
  media.tabIndex = 0;
  media.setAttribute("role", "button");
  media.setAttribute("aria-label", `Open ${block.alt || block.heading || project.title} fullscreen`);
}

function configureContentMediaFrame(media, block) {
  const intrinsicWidth = Number(block.mediaWidth || block.intrinsicWidth || 0);
  const intrinsicHeight = Number(block.mediaHeight || block.intrinsicHeight || 0);
  const aspectRatio = String(
    block.aspectRatio
    || (intrinsicWidth > 0 && intrinsicHeight > 0 ? `${intrinsicWidth} / ${intrinsicHeight}` : "16 / 9"),
  );
  media.style.setProperty("--media-aspect-ratio", aspectRatio);
  media.dataset.mediaFit = block.fit || "cover";
  if (block.posterFrame) {
    media.dataset.mediaPoster = "true";
    media.style.backgroundImage = `url(${JSON.stringify(block.posterFrame)})`;
  }
}

function normalizedContentHeading(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\.(?:GAME|PROJECT|DIR|FOLDER)$/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function renderContentBlocks(container, config, { suppressHeadings = [] } = {}) {
  const blocks = Array.isArray(config.blocks) ? config.blocks : [];
  const suppressed = new Set(suppressHeadings.map(normalizedContentHeading).filter(Boolean));
  container.replaceChildren();
  container.hidden = blocks.length === 0;

  blocks.forEach((block) => {
    const article = document.createElement("article");
    const isExternalCard = block.type === "link" && Boolean(block.href || block.source);
    article.className = `content-block content-block--${block.type || "text"}${isExternalCard ? " content-block--external-card" : ""}`;
    article.dataset.blockWidth = block.width || "full";

    if (block.heading && !isExternalCard && !suppressed.has(normalizedContentHeading(block.heading))) {
      const heading = document.createElement("h4");
      heading.className = "content-block__heading";
      heading.textContent = block.heading;
      article.append(heading);
    }

    if (block.type === "signal") {
      const receipt = document.createElement("div");
      receipt.className = "signal-receipt";

      if (block.source) {
        const evidence = document.createElement(block.href ? "a" : "div");
        evidence.className = "signal-receipt__evidence";
        if (block.href) {
          evidence.href = block.href;
          evidence.target = "_blank";
          evidence.rel = "noreferrer";
          evidence.dataset.staticControl = "";
          evidence.setAttribute("aria-label", "Open source post");
        }

        const image = document.createElement("img");
        image.alt = block.alt || "Source stat card";
        image.loading = "lazy";
        image.decoding = "async";
        setDeferredMediaSource(image, block.source);
        attachDeferredMedia(image);

        const source = document.createElement("span");
        source.className = "signal-receipt__source";
        source.textContent = block.href ? "SOURCE RECEIPT ↗" : "SOURCE RECEIPT";
        evidence.append(image, source);
        receipt.append(evidence);
      }

      const readout = document.createElement("div");
      readout.className = "signal-receipt__readout";

      const eyebrow = document.createElement("span");
      eyebrow.className = "signal-receipt__eyebrow";
      eyebrow.textContent = "NETWORK RESPONSE / OBSERVED";
      readout.append(eyebrow);

      const metrics = document.createElement("div");
      metrics.className = "signal-receipt__metrics";
      String(block.label || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          const [value, ...labelParts] = line.split("|");
          const metric = document.createElement("span");
          metric.className = "signal-receipt__metric";
          const strong = document.createElement("strong");
          strong.textContent = value.trim();
          const label = document.createElement("small");
          label.textContent = labelParts.join("|").trim() || "SIGNAL";
          metric.append(strong, label);
          metrics.append(metric);
        });
      readout.append(metrics);

      if (block.body) {
        const note = document.createElement("p");
        note.className = "signal-receipt__note";
        note.textContent = block.body;
        readout.append(note);
      }

      receipt.append(readout);
      article.append(receipt);
    } else if (block.type === "image" && block.source) {
      const media = document.createElement("div");
      media.className = "content-block__media";
      media.dataset.glitchMedia = "";
      media.dataset.scrollMediaReveal = "pending";
      configureContentMediaFrame(media, block);
      makeCreativeFullscreenTrigger(media, block);
      const image = document.createElement("img");
      setDeferredMediaSource(image, block.source);
      image.alt = block.alt || "";
      image.loading = "lazy";
      image.decoding = "async";
      image.style.objectFit = block.fit || "cover";
      media.append(image);
      article.append(media);
    } else if (block.type === "video" && block.source) {
      const media = document.createElement("div");
      media.className = "content-block__media";
      media.dataset.glitchMedia = "";
      media.dataset.scrollMediaReveal = "pending";
      configureContentMediaFrame(media, block);
      makeCreativeFullscreenTrigger(media, block);
      const video = document.createElement("video");
      video.className = "content-block__video";
      setDeferredMediaSource(video, block.source, block.posterFrame || "");
      video.controls = false;
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = "auto";
      video.style.objectFit = block.fit || "cover";
      video.addEventListener("canplay", () => video.play().catch(() => {}));
      attachDeferredMedia(video);
      media.append(video);
      article.append(media);
    } else if (block.type === "youtube" && block.source) {
      const videoId = youtubeVideoId(block.source);
      if (videoId) {
        const media = document.createElement("div");
        media.className = "content-block__media content-block__media--youtube";
        media.dataset.scrollMediaReveal = "pending";
        configureContentMediaFrame(media, { ...block, aspectRatio: block.aspectRatio || "16 / 9" });
        const iframe = document.createElement("iframe");
        iframe.className = "content-block__youtube";
        const playerParams = new URLSearchParams({
          rel: "0",
          autoplay: "1",
          mute: "1",
          controls: "1",
          playsinline: "1",
          loop: "1",
          playlist: videoId,
          fs: "1",
          cc_load_policy: "0",
          iv_load_policy: "3",
        });
        setDeferredMediaSource(iframe, `https://www.youtube.com/embed/${videoId}?${playerParams}`);
        iframe.title = block.alt || block.heading || "YouTube video";
        iframe.loading = "lazy";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        attachDeferredMedia(iframe);
        media.append(iframe);
        article.append(media);

        const sourceLink = document.createElement("a");
        sourceLink.className = "content-block__source-link";
        sourceLink.href = block.source;
        sourceLink.target = "_blank";
        sourceLink.rel = "noreferrer";
        sourceLink.textContent = "[OPEN ORIGINAL ↗]";
        article.append(sourceLink);
      }
    } else if (block.type === "vimeo" && block.source) {
      const embedSource = vimeoEmbedUrl(block.source);
      if (embedSource) {
        const media = document.createElement("div");
        media.className = "content-block__media content-block__media--vimeo";
        media.dataset.scrollMediaReveal = "pending";
        configureContentMediaFrame(media, { ...block, aspectRatio: block.aspectRatio || "16 / 9" });
        const iframe = document.createElement("iframe");
        iframe.className = "content-block__vimeo";
        setDeferredMediaSource(iframe, embedSource);
        iframe.title = block.alt || block.heading || "Vimeo video";
        iframe.loading = "lazy";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.allow = "autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share";
        iframe.allowFullscreen = true;
        attachDeferredMedia(iframe);
        media.append(iframe);
        article.append(media);

        const sourceLink = document.createElement("a");
        sourceLink.className = "content-block__source-link";
        sourceLink.href = block.source;
        sourceLink.target = "_blank";
        sourceLink.rel = "noreferrer";
        sourceLink.textContent = "[OPEN ORIGINAL ↗]";
        article.append(sourceLink);
      }
    } else if (block.type === "link" && (block.href || block.source)) {
      const link = document.createElement("a");
      link.className = `content-block__source-link${isExternalCard ? " content-block__source-link--external-card" : ""}`;
      link.href = block.href || block.source;
      link.target = "_blank";
      link.rel = "noreferrer";
      if (isExternalCard) {
        const arrow = document.createElement("span");
        arrow.className = "content-block__external-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "↗";

        const copy = document.createElement("span");
        copy.className = "content-block__external-copy";
        const label = document.createElement("strong");
        label.className = "control-label";
        label.textContent = block.label || block.heading || "OPEN LINK";
        const detail = document.createElement("small");
        detail.textContent = "OPENS EXTERNAL LINK";
        copy.append(label, detail);
        link.append(arrow, copy);
        link.setAttribute("aria-label", `${label.textContent} — opens external link`);
      } else {
        link.textContent = block.label || block.heading || "[OPEN LINK ↗]";
      }
      article.append(link);
    } else if (block.type === "project-link" && block.projectId) {
      const target = projectConfig(block.projectId);
      if (target) {
        const launch = document.createElement("button");
        launch.type = "button";
        launch.className = "content-block__project-launch";
        launch.dataset.openProject = block.projectId;
        launch.setAttribute("aria-label", `Open ${target.title || block.label || block.projectId}`);

        const icon = document.createElement("span");
        icon.className = "content-block__project-launch-icon project-pixel";
        icon.setAttribute("aria-hidden", "true");
        icon.append(createPixelIcon(target.icon || "video"));

        const copy = document.createElement("span");
        copy.className = "content-block__project-launch-copy";
        const label = document.createElement("strong");
        label.className = "control-label";
        label.textContent = block.label || target.shortcutLabel || target.title;
        copy.append(label);
        if (block.body) {
          const detail = document.createElement("small");
          detail.textContent = block.body;
          copy.append(detail);
        }
        launch.append(icon, copy);
        article.append(launch);
      }
    } else if (block.type === "routine") {
      const body = document.createElement("div");
      body.className = "content-block__body content-block__routine";

      if (block.intro) {
        const intro = document.createElement("p");
        intro.className = "content-block__routine-intro";
        intro.textContent = block.intro;
        body.append(intro);
      }

      (Array.isArray(block.lines) ? block.lines : []).forEach((line) => {
        const row = document.createElement("span");
        row.className = "content-block__routine-line";
        if (line.text) {
          row.textContent = line.text;
        } else {
          row.append(document.createTextNode(line.prefix || ""));
          const target = projectConfig(line.projectId);
          if (target) {
            const link = document.createElement("button");
            link.type = "button";
            link.className = "content-block__inline-project-link";
            link.dataset.openProject = line.projectId;
            link.textContent = line.label || target.shortcutLabel || target.title;
            link.setAttribute("aria-label", `Open ${target.title || link.textContent}`);
            row.append(link);
          } else {
            row.append(document.createTextNode(line.label || ""));
          }
          row.append(document.createTextNode(line.suffix || ""));
        }
        body.append(row);
      });

      article.append(body);
    }

    if (block.body && !["project-link", "signal"].includes(block.type)) {
      const body = document.createElement(block.type === "text" ? "p" : "small");
      body.className = "content-block__body";
      body.textContent = block.body;
      article.append(body);
    }

    container.append(article);
  });
}

function renderHomepage() {
  const title = $("[data-homepage-title]");
  const status = $("[data-homepage-status]");
  const container = $("[data-homepage-blocks]");
  if (!container) return;

  if (title) title.textContent = homepageData.title || "INNER_CHILD_UNLOCKED.TXT";
  if (status) status.textContent = homepageData.status || "";
  if (homepageData.about) {
    renderAboutHomepage(container, homepageData.about);
    installScrollMediaReveals(container, container.closest(".window__body"));
    return;
  }
  renderContentBlocks(container, homepageData);
  installScrollMediaReveals(container, container.closest(".window__body"));
}

function createAboutPhoto(source, alt, index) {
  const figure = document.createElement("figure");
  figure.className = "about-photo";
  figure.dataset.scrollMediaReveal = "pending";

  const image = document.createElement("img");
  setDeferredMediaSource(image, source);
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";

  const caption = document.createElement("figcaption");
  caption.textContent = String(index + 1).padStart(2, "0");
  figure.append(image, caption);
  return figure;
}

function createAboutDirectoryLink(label, target) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "about-directory__link";
  row.dataset.aboutTarget = target;
  row.textContent = label;
  return row;
}

function renderAboutHomepage(container, about) {
  container.replaceChildren();
  container.hidden = false;
  container.className = "about-homepage";
  delete container.dataset.scrollMediaRevealsInstalled;

  const overview = document.createElement("section");
  overview.className = "about-overview";
  overview.setAttribute("aria-labelledby", "about-name");

  const directory = document.createElement("nav");
  directory.className = "about-directory";
  directory.setAttribute("aria-label", "About me directory");
  const directoryHeading = document.createElement("p");
  directoryHeading.className = "about-directory__root";
  directoryHeading.textContent = "ABOUT_ME/";
  const tree = document.createElement("div");
  tree.className = "about-directory__tree";
  [
    ["├─ ME.JPG", "portrait"],
    ["├─ PHOTOGRAPHY/", "photography"],
    ["├─ CURRENTLY.TXT", "currently"],
    ["├─ PLACES.LOG", "places"],
    ["└─ CONTACT.CARD", "contact"],
  ].forEach(([label, target]) => tree.append(createAboutDirectoryLink(label, target)));
  directory.append(directoryHeading, tree);

  const portrait = document.createElement("figure");
  portrait.className = "about-portrait";
  portrait.id = "about-portrait";
  portrait.dataset.scrollMediaReveal = "pending";
  const portraitImage = document.createElement("img");
  setDeferredMediaSource(portraitImage, about.portrait);
  portraitImage.alt = `Portrait of ${about.name || "David Svezhintsev"}`;
  portraitImage.loading = "eager";
  portraitImage.decoding = "async";
  const portraitCaption = document.createElement("figcaption");
  portraitCaption.textContent = "ME.JPG / SELF PORTRAIT";
  portrait.append(portraitImage, portraitCaption);

  const copy = document.createElement("div");
  copy.className = "about-copy";
  copy.id = "about-currently";
  const eyebrow = document.createElement("p");
  eyebrow.className = "about-copy__eyebrow";
  eyebrow.textContent = "CURRENTLY.TXT";
  const name = document.createElement("h3");
  name.id = "about-name";
  name.textContent = about.name || "David Svezhintsev";
  const intro = document.createElement("p");
  intro.className = "about-copy__intro";
  intro.textContent = about.intro || "";
  const bio = document.createElement("p");
  bio.className = "about-copy__bio";
  bio.textContent = about.bio || "";
  copy.append(eyebrow, name, intro, bio);
  overview.append(directory, portrait, copy);

  const photography = document.createElement("section");
  photography.className = "about-photography";
  photography.id = "about-photography";
  photography.setAttribute("aria-labelledby", "about-photography-heading");
  const photographyHeader = document.createElement("header");
  photographyHeader.className = "about-photography__header";
  const photographyPath = document.createElement("p");
  photographyPath.textContent = "ABOUT_ME/PHOTOGRAPHY/";
  const photographyHeading = document.createElement("h3");
  photographyHeading.id = "about-photography-heading";
  photographyHeading.textContent = "PHOTOGRAPHY";
  const photographyIntro = document.createElement("p");
  photographyIntro.textContent = about.photographyIntro || "";
  photographyHeader.append(photographyPath, photographyHeading, photographyIntro);
  photography.append(photographyHeader);

  const places = document.createElement("div");
  places.className = "about-places";
  places.id = "about-places";
  const groups = Array.isArray(about.photoGroups) ? about.photoGroups : [];
  groups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "about-place";
    const heading = document.createElement("header");
    heading.className = "about-place__header";
    const location = document.createElement("h4");
    location.textContent = group.location || "UNTITLED PLACE";
    const count = document.createElement("span");
    const photos = Array.isArray(group.photos) ? group.photos : [];
    count.textContent = `${String(photos.length).padStart(2, "0")} FILES`;
    heading.append(location, count);
    const grid = document.createElement("div");
    grid.className = "about-photo-grid";
    grid.style.setProperty("--about-photo-columns", String(Math.min(6, Math.max(1, photos.length))));
    photos.forEach((source, index) => {
      grid.append(createAboutPhoto(source, `${group.location || "Travel"} photograph ${index + 1}`, index));
    });
    section.append(heading, grid);
    places.append(section);
  });
  photography.append(places);
  container.append(overview, photography);
}

async function animateMediaRevealSnapshot(element, source, duration = 480) {
  const overlay = document.createElement("canvas");
  overlay.className = "media-scramble-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.opacity = "0";
  element.append(overlay);

  const renderer = new AsciiMediaRenderer(overlay, source, {
    fontSize: 20,
    lineHeight: 20,
    monochrome: false,
    fit: getComputedStyle(source).objectFit || "cover",
  });
  const appearDuration = Math.min(130, duration * 0.28);
  const glyphHoldDuration = Math.min(90, duration * 0.2);
  const dissolveDuration = Math.max(220, duration - appearDuration - glyphHoldDuration);
  let appearAnimation;
  let dissolveAnimation;

  source.style.opacity = "0";
  renderer.stop();
  renderer.setMediaScrambleProgress(0.82);
  renderer.render();

  try {
    appearAnimation = overlay.animate(
      [
        { opacity: 0, transform: "scale(1.012)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      {
        duration: appearDuration,
        easing: "steps(4, end)",
        fill: "both",
      },
    );
    await appearAnimation.finished.catch(() => {});
    if (!element.isConnected) return;
    await wait(glyphHoldDuration);
    if (!element.isConnected) return;

    source.style.opacity = "1";
    overlay.classList.add("is-cell-dissolving");
    dissolveAnimation = overlay.animate(
      [
        { opacity: 1 },
        { opacity: 0.72, offset: 0.38 },
        { opacity: 0 },
      ],
      {
        duration: dissolveDuration,
        easing: "steps(8, end)",
        fill: "both",
      },
    );
    await dissolveAnimation.finished.catch(() => {});
  } finally {
    renderer.stop();
    appearAnimation?.cancel();
    dissolveAnimation?.cancel();
    overlay.remove();
    source.style.removeProperty("opacity");
  }
}

let nextScrollMediaRevealStart = 0;

function queueScrollMediaReveal(element) {
  if (!element?.isConnected || element.dataset.scrollMediaReveal !== "pending") return;
  element.dataset.scrollMediaReveal = "queued";
  const now = performance.now();
  const delay = Math.max(0, nextScrollMediaRevealStart - now);
  nextScrollMediaRevealStart = Math.max(now, nextScrollMediaRevealStart) + 24;
  window.setTimeout(async () => {
    if (!element.isConnected) return;
    if (element.dataset.scrollMediaVisible !== "true") {
      element.dataset.scrollMediaReveal = "pending";
      return;
    }
    element.dataset.scrollMediaReveal = "pending";
    try {
      await revealScrollMedia(element);
    } catch {
      delete element.dataset.scrollMediaReveal;
      $("img, video", element)?.style.removeProperty("opacity");
    }
  }, delay);
}

async function revealScrollMedia(element, duration = 480) {
  if (!element?.isConnected || element.dataset.scrollMediaReveal !== "pending") return;
  element.dataset.scrollMediaReveal = "loading";
  const source = $("img, video, iframe", element);
  if (!source) {
    delete element.dataset.scrollMediaReveal;
    return;
  }
  attachDeferredMedia(source);
  if (source instanceof HTMLIFrameElement) {
    delete element.dataset.scrollMediaReveal;
    return;
  }

  if (source instanceof HTMLImageElement) {
    if (!source.complete) await waitForEvent(source, "load", 4000);
    if (source.decode) await source.decode().catch(() => {});
  } else if (source.readyState < 2) {
    await waitForEvent(source, "loadeddata", 4000);
  }
  if (!element.isConnected) return;

  const reducedMotion = prefersReducedMotion();
  if (reducedMotion) {
    source.style.removeProperty("opacity");
    delete element.dataset.scrollMediaReveal;
    return;
  }

  element.dataset.scrollMediaReveal = "running";
  await animateMediaRevealSnapshot(element, source, duration);
  delete element.dataset.scrollMediaReveal;
  if (element.dataset.scrollMediaVisible !== "true" && !(source instanceof HTMLVideoElement)) detachDeferredMedia(source);
}

function installScrollMediaReveals(container, observerRoot = container) {
  if (!container || container.dataset.scrollMediaRevealsInstalled === "true") return;
  container.dataset.scrollMediaRevealsInstalled = "true";
  const mediaBlocks = $$('[data-scroll-media-reveal="pending"]', container);
  if (!mediaBlocks.length) return;

  if (!("IntersectionObserver" in window)) {
    mediaBlocks.forEach((element) => {
      element.dataset.scrollMediaVisible = "true";
      queueScrollMediaReveal(element);
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const source = $("img, video, iframe", entry.target);
        if (entry.isIntersecting) {
          entry.target.dataset.scrollMediaVisible = "true";
          attachDeferredMedia(source);
          queueScrollMediaReveal(entry.target);
        } else {
          delete entry.target.dataset.scrollMediaVisible;
          if (!(source instanceof HTMLVideoElement) && !["loading", "running"].includes(entry.target.dataset.scrollMediaReveal)) {
            detachDeferredMedia(source);
          }
        }
      });
    },
    {
      root: observerRoot,
      rootMargin: "800px 0px",
      threshold: 0.01,
    },
  );
  mediaBlocks.forEach((element) => observer.observe(element));
  state.mediaLifecycles.set(container, { observer, elements: mediaBlocks });
}

function renderRevealBenchmark() {
  const container = $("#reveal-benchmark-grid");
  if (!container) return;
  const sources = [
    ["assets/media/boot-first-frame.webp", "Visual boot frame"],
    ["assets/media/optimized/Projects/VoidOverdrive/void-overdrive-desert-outpost.webp", "Void Overdrive desert outpost"],
    ["assets/media/optimized/Projects/VoidOverdrive/void-overdrive-desert-pillar-run.webp", "Void Overdrive desert pillar run"],
    ["assets/media/optimized/Projects/Flax/FlaxEditorScreenshot.webp", "Flax Editor screenshot"],
    ["assets/media/optimized/Projects/UX/UserWise/userwise-design-exploration.webp", "UserWise design exploration"],
    ["assets/media/optimized/Projects/UX/RiseAboveDisorder/rise-above-disorder-about-page.webp", "Rise Above Disorder about page"],
  ];
  renderContentBlocks(container, {
    blocks: sources.map(([source, alt], index) => ({
      id: `reveal-benchmark-${index + 1}`,
      type: "image",
      width: "third",
      heading: `IMAGE / ${String(index + 1).padStart(2, "0")}`,
      source,
      alt,
      fit: "cover",
    })),
  });
  installScrollMediaReveals(container, null);
}

function renderBlog() {
  const container = $("#blog-index");
  container.replaceChildren();
  const posts = blogData.filter((post) => post.published !== false);

  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "NO TRANSMISSIONS PUBLISHED YET.";
    container.append(empty);
    return;
  }

  posts.forEach((post, index) => {
    const article = document.createElement("article");
    article.className = "blog-entry";
    article.id = `blog-${post.id}`;

    const titlebar = document.createElement("div");
    titlebar.className = "blog-entry__titlebar";
    const title = document.createElement("h3");
    title.textContent = post.title;
    const date = document.createElement("time");
    date.dateTime = post.date || "";
    date.textContent = post.date || `ENTRY ${String(index + 1).padStart(2, "0")}`;
    titlebar.append(title, date);

    const body = document.createElement("div");
    body.className = "blog-entry__body";
    if (post.summary) {
      const summary = document.createElement("p");
      summary.className = "blog-entry__summary";
      summary.textContent = post.summary;
      body.append(summary);
    }
    const blocks = document.createElement("div");
    blocks.className = "content-block-grid";
    renderContentBlocks(blocks, post);
    installScrollMediaReveals(blocks, null);
    body.append(blocks);
    article.append(titlebar, body);
    container.append(article);
  });
}

function renderContact() {
  $("[data-contact-heading]").textContent = contactData.heading;
  $("[data-contact-intro]").textContent = contactData.intro;
  $("[data-contact-availability]").textContent = contactData.availability;
  $("[data-contact-location]").textContent = contactData.location;
}

async function playProjectPreview(windowElement, projectId) {
  const config = projectConfig(projectId);
  const loader = $("[data-project-loader]", windowElement);
  const folder = $("[data-project-folder]", windowElement);
  const canvas = $("[data-project-canvas]", windowElement);
  const reducedMotion = prefersReducedMotion();
  const token = crypto.randomUUID();
  windowElement.dataset.previewToken = token;
  const statuses = Array.isArray(config.status) && config.status.length
    ? config.status
    : Array.from({ length: 4 }, (_, index) => `LOADING ${index + 1}/4`);
  const needsMedia = Boolean(config.source)
    && config.layout !== "text-window"
    && (!animationsDisabled || config.layout === "media-fullscreen");
  const isFullscreen = config.layout === "media-fullscreen";
  folder.scrollTop = 0;

  const sourcePromise = needsMedia ? loadProjectSource(windowElement, config) : Promise.resolve(null);
  let source = null;
  const sourceCheckpoint = Math.max(0, Math.ceil(statuses.length / 2) - 1);
  for (let index = 0; index < statuses.length; index += 1) {
    await setProjectProgress(
      windowElement,
      (index + 1) / statuses.length,
      statuses[index],
      reducedMotion ? 0 : index === 0 ? 130 : 180,
    );
    if (index === sourceCheckpoint) source = await sourcePromise;
    if (!windowElement.isConnected || windowElement.dataset.previewToken !== token) return;
  }
  if (!source) source = await sourcePromise;
  if (!windowElement.isConnected || windowElement.dataset.previewToken !== token) return;

  if (reducedMotion) {
    loader.classList.add("is-hidden");
    canvas.hidden = true;
    if (config.layout === "media-fullscreen" && source) source.classList.add("is-output");
    else {
      folder.classList.add("is-revealed");
      installScrollMediaReveals(folder);
    }
    return;
  }

  if (!source) {
    loader.classList.add("is-hidden");
    canvas.hidden = true;
    folder.classList.add("is-revealed");
    installScrollMediaReveals(folder);
    await runInterfaceSplitFlap(folder);
    return;
  }

  if (source instanceof HTMLIFrameElement) {
    loader.classList.add("is-hidden");
    canvas.hidden = true;
    source.classList.add("is-output");
    return;
  }

  const renderer = new AsciiMediaRenderer(canvas, source, {
    fontSize: 22,
    lineHeight: 22,
    fps: 24,
    monochrome: false,
    fit: config.previewFit || "cover",
    targetRects: [{ left: 0, top: 0, right: canvas.clientWidth, bottom: canvas.clientHeight }],
  });
  state.projectRenderers.set(windowElement, renderer);
  renderer.setMediaScrambleProgress(0);
  renderer.start();
  loader.classList.add("is-hidden");

  if (isFullscreen) {
    await animateValue(0, 0.78, 560, (value) => renderer.setMediaScrambleProgress(value));
    if (!windowElement.isConnected || windowElement.dataset.previewToken !== token) return;
    renderer.setCellDissolveProgress(0);
    renderer.render();
    source.classList.add("is-output");
    canvas.classList.add("is-cell-dissolving");
    await Promise.all([
      animateValue(0.78, 1, 760, (value) => renderer.setMediaScrambleProgress(value)),
      animateValue(0, 1, 920, (value) => renderer.setCellDissolveProgress(value)),
    ]);
    renderer.setMediaScrambleProgress(null);
    renderer.setCellDissolveProgress(null);
  } else {
    await animateValue(0, 1, 760, (value) => renderer.setMediaScrambleProgress(value));
    renderer.setMediaScrambleProgress(null);
    await wait(180);
    if (!windowElement.isConnected || windowElement.dataset.previewToken !== token) return;
    folder.classList.add("is-revealed");
    installScrollMediaReveals(folder);
    const exactFolder = runInterfaceSplitFlap(folder);
    const previewDissolve = canvas.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 320, easing: "steps(6, end)", fill: "forwards" },
    ).finished;
    await Promise.all([exactFolder, previewDissolve]);
  }
  renderer.stop();
  state.projectRenderers.delete(windowElement);
  canvas.hidden = true;
  if (!isFullscreen && source instanceof HTMLVideoElement) source.pause();
}

function rectSnapshot(rect) {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function resolveProjectOrigin(windowElement) {
  const record = state.projectOrigins.get(windowElement);
  if (record?.element?.isConnected) {
    const liveRect = record.element.getBoundingClientRect();
    if (liveRect.width && liveRect.height) return rectSnapshot(liveRect);
  }
  if (record?.rect?.width && record?.rect?.height) return record.rect;
  const finalRect = windowElement.getBoundingClientRect();
  return {
    left: finalRect.left + 22,
    top: finalRect.top + 22,
    width: Math.min(88, finalRect.width),
    height: Math.min(66, finalRect.height),
  };
}

function createWindowTransitionField(windowElement, progress = 0) {
  $(".window-transition-glyphs", windowElement)?.remove();
  const canvas = document.createElement("canvas");
  canvas.className = "window-transition-glyphs";
  canvas.setAttribute("aria-hidden", "true");
  windowElement.append(canvas);
  const rect = windowElement.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.ceil(rect.width * dpr));
  canvas.height = Math.max(1, Math.ceil(rect.height * dpr));
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  const field = {
    canvas,
    context,
    width: rect.width,
    height: rect.height,
    seed: Math.random() * 1000,
  };
  drawWindowTransitionField(field, progress);
  return field;
}

function drawWindowTransitionField(field, progress) {
  const { context, width, height, seed } = field;
  const cellWidth = 11;
  const cellHeight = 22;
  const columns = Math.ceil(width / cellWidth);
  const rows = Math.ceil(height / cellHeight);
  const tick = Math.floor(performance.now() / 42);
  const amount = clamp(progress);
  context.clearRect(0, 0, width, height);
  context.font = '11px "Departure Mono", monospace';
  context.textBaseline = "top";

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const gate = hash2d(x, y, seed);
      if (amount < gate) continue;
      const glyphIndex = Math.floor(hash2d(x, y, seed + tick) * scrambleGlyphs.length);
      const brightness = Math.round(118 + hash2d(x, y, seed + 17) * 137);
      context.fillStyle = "#000000";
      context.fillRect(x * cellWidth, y * cellHeight, cellWidth + 1, cellHeight + 1);
      context.fillStyle = `rgb(${brightness} ${brightness} ${brightness})`;
      context.fillText(scrambleGlyphs[glyphIndex], x * cellWidth, y * cellHeight);
    }
  }
}

function animateWindowTransitionField(field, from, to, duration) {
  if (!duration) {
    drawWindowTransitionField(field, to);
    return Promise.resolve();
  }
  return animateValue(from, to, duration, (value) => drawWindowTransitionField(field, value));
}

function churnWindowTransitionField(field, duration, progress = 1) {
  if (!duration) return Promise.resolve();
  const started = performance.now();
  return new Promise((resolve) => {
    const frame = (now) => {
      if (!field.canvas.isConnected || now - started >= duration) {
        resolve();
        return;
      }
      drawWindowTransitionField(field, progress);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

async function animateProjectWindowGeometry(windowElement, originRect, opening, duration) {
  if (!windowElement.isConnected || !duration) return;
  const finalRect = windowElement.getBoundingClientRect();
  const scaleX = clamp(originRect.width / finalRect.width, 0.02, 1);
  const scaleY = clamp(originRect.height / finalRect.height, 0.02, 1);
  const compactTransform = `translate(${originRect.left - finalRect.left}px, ${originRect.top - finalRect.top}px) scale(${scaleX}, ${scaleY})`;
  windowElement.classList.add("is-geometry-transition");
  const animation = windowElement.animate(
    opening
      ? [{ transform: compactTransform }, { transform: "translate(0, 0) scale(1, 1)" }]
      : [{ transform: "translate(0, 0) scale(1, 1)" }, { transform: compactTransform }],
    {
      duration,
      easing: opening ? "cubic-bezier(0.16, 1, 0.3, 1)" : "cubic-bezier(0.7, 0, 0.84, 0)",
      fill: "both",
    },
  );
  await animation.finished.catch(() => {});
  if (!windowElement.isConnected) return;
  if (!opening) windowElement.style.transform = compactTransform;
  animation.cancel();
  windowElement.classList.remove("is-geometry-transition");
}

function projectUrl(projectId = null) {
  const url = new URL(window.location.href);
  url.pathname = projectId ? `${appBasePath}/project/${encodeURIComponent(projectId)}` : `${appBasePath}/`;
  return url;
}

function projectIdFromLocation() {
  const routePath = window.location.pathname.slice(appBasePath.length) || "/";
  const match = routePath.match(/^\/project\/([^/]+)\/?$/i);
  return match ? decodeURIComponent(match[1]).toLowerCase() : null;
}

function updateProjectHistory(projectId, mode = "push") {
  if (mode === "none") return;
  const url = projectUrl(projectId);
  const payload = { ...history.state, projectId: projectId || null };
  if (mode === "replace") history.replaceState(payload, "", url);
  else history.pushState(payload, "", url);
}

function destroyProjectWindow(windowElement) {
  if (!windowElement) return;
  const projectId = windowElement.dataset.projectWindow;
  windowElement.dataset.previewToken = "closed";
  state.projectRenderers.get(windowElement)?.stop();
  state.projectRenderers.delete(windowElement);
  teardownDeferredMedia(windowElement);
  windowElement.remove();
  unloadProjectPage(projectId);
}

async function closeProjectWindow(windowElement, { historyMode = "push" } = {}) {
  if (!windowElement?.isConnected || windowElement.dataset.closing === "true") return;
  windowElement.dataset.closing = "true";
  const wasFullscreen = windowElement.dataset.layout === "media-fullscreen";
  windowElement.dataset.previewToken = "closed";
  state.projectRenderers.get(windowElement)?.stop();
  state.projectRenderers.delete(windowElement);
  $$('video', windowElement).forEach((video) => video.pause());
  windowElement.getAnimations().forEach((animation) => animation.cancel());
  windowElement.classList.remove("is-geometry-transition");

  if (wasFullscreen) {
    state.glyphCursor.fullscreenClose = false;
    state.glyphCursor.actionLabel = "";
    const cursor = $("#glyph-cursor");
    cursor?.classList.remove("is-visible", "is-fullscreen-close");
    restoreGlyphCursor();
  }

  const reducedMotion = prefersReducedMotion();
  const fillDuration = reducedMotion ? 0 : 210;
  const dissolveDuration = reducedMotion ? 0 : 140;
  const field = createWindowTransitionField(windowElement, 0);
  await animateWindowTransitionField(field, 0, 1, fillDuration);
  if (!windowElement.isConnected) return;

  const disappearance = dissolveDuration
    ? windowElement.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      {
        duration: dissolveDuration,
        easing: "steps(5, end)",
        fill: "forwards",
      },
    )
    : null;
  await Promise.all([
    churnWindowTransitionField(field, dissolveDuration, 1),
    disappearance?.finished.catch(() => {}),
  ]);
  if (!windowElement.isConnected) return;
  destroyProjectWindow(windowElement);
  syncFullscreenProjectState();
  const nextWindow = topProjectWindow() || topOsWindow();
  if (nextWindow) bringToFront(nextWindow);
  else syncWindowFocusLayer();
  if (historyMode !== "none") {
    updateProjectHistory(nextWindow?.dataset.projectWindow || null, historyMode);
  }
}

function topProjectWindow() {
  return $$('[data-project-window]').reduce((top, candidate) => {
    if (!top) return candidate;
    const topLayer = Number(top.style.zIndex || 0);
    const candidateLayer = Number(candidate.style.zIndex || 0);
    return candidateLayer >= topLayer ? candidate : top;
  }, null);
}

async function openProject(projectId, originElement = null, { historyMode = "push" } = {}) {
  const existing = $(`[data-project-window="${projectId}"]`);
  if (existing) {
    bringToFront(existing);
    updateProjectHistory(projectId, historyMode);
    return;
  }

  if (!projectConfig(projectId) || openingProjects.has(projectId)) return;
  openingProjects.add(projectId);
  const config = await loadProjectPage(projectId);
  openingProjects.delete(projectId);
  if (!config) return;
  const duplicate = $(`[data-project-window="${projectId}"]`);
  if (duplicate) {
    bringToFront(duplicate);
    updateProjectHistory(projectId, historyMode);
    return;
  }
  const launchRect = originElement?.getBoundingClientRect();
  updateMobileProjectInset();
  const template = $("#project-window-template");
  const windowElement = template.content.firstElementChild.cloneNode(true);
  state.projectOrigins.set(windowElement, {
    element: originElement,
    rect: launchRect?.width && launchRect?.height ? rectSnapshot(launchRect) : null,
  });
  windowElement.dataset.projectWindow = projectId;
  windowElement.dataset.layout = config.layout || "folder";
  windowElement.dataset.windowMode = config.windowMode || "standard";
  if (windowElement.dataset.layout === "media-fullscreen") {
    const stage = $(".project-stage", windowElement);
    stage.setAttribute("aria-label", `${config.heading || config.title} media viewer`);
  }
  windowElement.style.setProperty("--project-min-width", config.windowWidth || "748px");
  windowElement.style.setProperty("--project-min-height", config.windowHeight || "506px");
  windowElement.style.setProperty("--text-content-width", config.textWidth || "62ch");
  windowElement.style.left = "0px";
  windowElement.style.top = "22px";
  $("[data-project-title]", windowElement).textContent = config.title;
  const projectKind = $("[data-project-kind]", windowElement);
  if (projectKind) projectKind.textContent = config.kind;
  $("[data-project-heading]", windowElement).textContent = config.heading;
  $("[data-project-description]", windowElement).textContent = config.description;
  $("[data-project-role]", windowElement).textContent = config.role || "DESIGN / DEVELOPMENT";
  $("[data-project-state]", windowElement).textContent = config.state || "PREVIEW COMPLETE";
  $("[data-project-route]", windowElement).textContent = config.route || "/PROJECT/PLACEHOLDER";
  $("[data-text-kind]", windowElement).textContent = config.kind || "TEXT TRANSMISSION";
  $("[data-text-heading]", windowElement).textContent = config.heading;
  $("[data-project-body]", windowElement).textContent = config.body || config.description;
  const folderLayout = $("[data-folder-layout]", windowElement);
  const textLayout = $("[data-text-layout]", windowElement);
  folderLayout.hidden = config.layout === "text-window";
  textLayout.hidden = config.layout !== "text-window";
  $("[data-project-overview]", windowElement).hidden = config.showOverview === false;
  const projectBlocks = Array.isArray(config.blocks) ? config.blocks : [];
  const usesAuthoredLead = config.showOverview === false && projectBlocks[0]?.type === "text";
  renderContentBlocks($("[data-content-blocks-lead]", windowElement), {
    blocks: usesAuthoredLead ? projectBlocks.slice(0, 1) : [],
  }, { suppressHeadings: [config.heading, config.title] });
  renderContentBlocks($("[data-content-blocks]", windowElement), {
    blocks: usesAuthoredLead ? projectBlocks.slice(1) : projectBlocks,
  }, { suppressHeadings: [config.heading, config.title] });
  windowElement.classList.toggle("has-content-blocks", projectBlocks.length > 0);
  renderProjectChildren($("[data-project-children]", windowElement), projectId);
  windowElement.classList.toggle("has-child-projects", projectHasChildren(projectId));
  renderFullscreenMediaNavigation(windowElement);
  $("#workspace").append(windowElement);
  $("[data-project-folder]", windowElement).scrollTo({ top: 0, left: 0 });
  updateProjectHistory(projectId, historyMode);
  syncFullscreenProjectState({ syncDecorativeMedia: false });
  installWindowBehavior(windowElement);
  bringToFront(windowElement);
  fitProjectWindowToWorkspace(windowElement, { cascade: true });
  const reducedMotion = prefersReducedMotion();
  const expandDuration = reducedMotion ? 0 : 560;
  const originRect = resolveProjectOrigin(windowElement);
  await animateProjectWindowGeometry(windowElement, originRect, true, expandDuration);
  if (!windowElement.isConnected || windowElement.dataset.closing === "true") return;
  syncDecorativeMediaPlayback();
  playWindowEdgeGlitch(windowElement, 680);
  scrambleTree($(".window__titlebar", windowElement), 640);

  $("[data-close-project]", windowElement).addEventListener("click", () => {
    closeProjectWindow(windowElement);
  });

  playProjectPreview(windowElement, projectId);
}

function syncDecorativeMediaPlayback() {
  const logoVideo = $("#boot-logo-video");
  const logoIsDocked = $("#grid-logo-slot")?.contains(logoVideo);
  const fullscreenActive = Boolean($('.project-window[data-layout="media-fullscreen"]'));
  state.glyphNoise.paused = fullscreenActive;
  const shouldPlay = logoIsDocked && logoVideo?.offsetParent !== null && state.page === "home" && !fullscreenActive;
  if (shouldPlay) {
    attachDeferredMedia(logoVideo);
    if (logoVideo.paused) logoVideo.play().catch(() => {});
  } else if (logoVideo) {
    detachDeferredMedia(logoVideo);
  }
}

function syncFullscreenProjectState({ syncDecorativeMedia = true } = {}) {
  const hasProjectWindow = state.page === "home" && Boolean($(".project-window"));
  const active = hasProjectWindow && Boolean($('.project-window[data-layout="media-fullscreen"]'));
  document.documentElement.classList.toggle("has-project-window", hasProjectWindow);
  document.body.classList.toggle("has-project-window", hasProjectWindow);
  document.documentElement.classList.toggle("has-fullscreen-project", active);
  document.body.classList.toggle("has-fullscreen-project", active);
  if (syncDecorativeMedia) syncDecorativeMediaPlayback();
  requestAnimationFrame(() => refreshGlyphCursorAtPointer({ forceFullscreen: active }));
}

function mobileGridOnly() {
  return window.matchMedia("(max-width: 720px)").matches;
}

function osWindow(target) {
  return $(`[data-os-window="${target}"]`);
}

function topOsWindow() {
  return $$('[data-os-window][data-os-open="true"]:not([hidden])').reduce((top, candidate) => {
    if (!top) return candidate;
    return Number(candidate.style.zIndex || 0) >= Number(top.style.zIndex || 0) ? candidate : top;
  }, null);
}

async function openOsWindow(target) {
  if (document.body.dataset.view !== "os") return;
  const windowElement = osWindow(target);
  if (!windowElement) return;
  windowElement.hidden = false;
  windowElement.dataset.osOpen = "true";
  windowElement.removeAttribute("data-closing");
  if (target === "monitor") {
    $(".window__body", windowElement)?.scrollTo({ top: 0, left: 0 });
  }
  bringToFront(windowElement);
  playWindowEdgeGlitch(windowElement, 520);
  await runInterfaceSplitFlap(windowElement, 420, 0.54);
  requestAnimationFrame(refreshWindowEdges);
}

async function closeOsWindow(windowElement) {
  if (!windowElement || windowElement.hidden || windowElement.dataset.closing === "true") return;
  windowElement.dataset.closing = "true";
  await runInterfaceSplitFlap(windowElement, 220, 0.8);
  windowElement.hidden = true;
  windowElement.dataset.osOpen = "false";
  windowElement.removeAttribute("data-closing");
  windowElement.classList.remove("is-active");
  const nextWindow = topProjectWindow() || topOsWindow();
  if (nextWindow) bringToFront(nextWindow);
  else syncWindowFocusLayer();
}

function syncOsWindowVisibility(view) {
  const enteringOs = view === "os";
  $$('[data-os-window]').forEach((windowElement) => {
    windowElement.dataset.osOpen = "false";
    windowElement.hidden = enteringOs;
    windowElement.classList.remove("is-active");
  });
  if (!enteringOs) {
    syncWindowFocusLayer();
    return;
  }

  $$('[data-project-window]').forEach((windowElement) => {
    destroyProjectWindow(windowElement);
  });
  syncFullscreenProjectState();
  syncWindowFocusLayer();
}

function applyView(view) {
  if (!['os', 'grid', 'list'].includes(view)) return;
  if (mobileGridOnly()) view = "grid";
  document.body.dataset.view = view;
  if (view !== "os" && state.secrets.cheatCode) setCheatCode(false);
  syncOsWindowVisibility(view);
  const projectCount = $(".window--index .window__status");
  if (projectCount) {
    const count = view === "list" ? Object.keys(projectData).length : projectChildren(null).length;
    projectCount.textContent = `${String(count).padStart(2, "0")} ITEMS`;
  }
  $$('[data-view-button]').forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.viewButton === view));
  });
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  history.replaceState(history.state || {}, "", url);
  requestAnimationFrame(() => {
    if ($("#grid-logo-slot")?.contains($("#boot-logo-video"))) syncDecorativeMediaPlayback();
  });
  requestAnimationFrame(refreshWindowEdges);
}

function applyPage(page, historyMode = "replace") {
  if (!["home", "blog", "contact", "reveal-benchmark"].includes(page)) return;
  if (page !== "home") {
    $$('[data-project-window]').forEach((windowElement) => destroyProjectWindow(windowElement));
  }
  state.page = page;
  document.body.dataset.page = page;
  $$('[data-page-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.pagePanel !== page;
  });
  $$('[data-page-button]').forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.pageButton === page));
  });
  $("[data-home-controls]").hidden = page !== "home";
  const url = new URL(window.location.href);
  if (page !== "home") url.pathname = `${appBasePath}/`;
  if (page === "home") url.searchParams.delete("page");
  else url.searchParams.set("page", page);
  if (historyMode === "push") history.pushState({ page }, "", url);
  else if (historyMode === "replace") history.replaceState({ page }, "", url);
  syncFullscreenProjectState();
  requestAnimationFrame(refreshWindowEdges);
}

async function transitionPage(page, historyMode = "push") {
  if (!["home", "blog", "contact", "reveal-benchmark"].includes(page) || page === state.page || state.viewTransitioning) return;
  if (animationsDisabled) {
    applyPage(page, historyMode);
    return;
  }
  state.viewTransitioning = true;
  document.body.classList.add("is-view-switching");
  const current = $(`[data-page-panel="${state.page}"]`);
  if (current) await runInterfaceSplitFlap(current, 360, 0.72);
  applyPage(page, historyMode);
  const next = $(`[data-page-panel="${page}"]`);
  if (next) {
    await Promise.all([
      runInterfaceSplitFlap(next, 680, 0.58),
      ...$$('[data-glitch-media]:not([data-scroll-media-reveal])', next)
        .map((element) => scrambleMediaElement(element)),
    ]);
  }
  document.body.classList.remove("is-view-switching");
  state.viewTransitioning = false;
}

async function transitionView(view) {
  if (!['os', 'grid', 'list'].includes(view)) return;
  if (mobileGridOnly()) view = "grid";
  if (document.body.dataset.view === view || state.viewTransitioning) return;
  if (animationsDisabled) {
    applyView(view);
    return;
  }
  const token = state.viewTransitionToken + 1;
  state.viewTransitionToken = token;
  state.viewTransitioning = true;
  document.body.classList.add("is-view-switching");

  const flaps = runInterfaceSplitFlap($("#site"));

  await wait(260);
  if (state.viewTransitionToken !== token) return;
  applyView(view);
  await flaps;
  if (state.viewTransitionToken !== token) return;
  document.body.classList.remove("is-view-switching");
  state.viewTransitioning = false;
}

async function reconcileLocation({ initial = false } = {}) {
  const projectId = projectIdFromLocation();
  const page = new URL(window.location.href).searchParams.get("page") || "home";
  if (projectId && projectConfig(projectId)) {
    if (state.page !== "home") await transitionPage("home", "none");
    for (const windowElement of $$('[data-project-window]')) {
      if (windowElement.dataset.projectWindow !== projectId) {
        await closeProjectWindow(windowElement, { historyMode: "none" });
      }
    }
    await openProject(projectId, null, { historyMode: initial ? "replace" : "none" });
    return;
  }
  for (const windowElement of $$('[data-project-window]')) {
    await closeProjectWindow(windowElement, { historyMode: "none" });
  }
  if (page !== state.page) await transitionPage(page, "none");
  if (initial && projectId) updateProjectHistory(null, "replace");
}

function resetHome() {
  state.viewTransitionToken += 1;
  state.viewTransitioning = false;
  document.body.classList.remove("is-view-switching");
  $$('[data-project-window]').forEach((windowElement) => {
    destroyProjectWindow(windowElement);
  });
  syncFullscreenProjectState();
  $$('[data-window]:not([data-project-window])').forEach((windowElement) => {
    windowElement.classList.remove("is-active");
    ["left", "top", "z-index", "transform"].forEach((property) => {
      windowElement.style.removeProperty(property);
    });
    $(".window__body", windowElement)?.scrollTo({ top: 0, left: 0 });
  });
  syncWindowFocusLayer();
  applyPage("home", "none");
  applyView("grid");
  updateProjectHistory(null, "push");
  window.scrollTo({ top: 0, left: 0 });
  runInterfaceSplitFlap($("#site"), 620, 0.58);
}

async function submitContactForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formStatus = $("#contact-form-status");
  if (!form.reportValidity()) return;
  if (["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:") {
    formStatus.textContent = "LOCAL PREVIEW / NETLIFY ACCEPTS THIS AFTER DEPLOY";
    return;
  }
  formStatus.textContent = "TRANSMITTING...";
  const response = await fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(new FormData(form)).toString(),
  });
  if (!response.ok) throw new Error(`Transmission rejected: ${response.status}`);
  form.reset();
  formStatus.textContent = "MESSAGE RECEIVED / I WILL GET BACK TO YOU";
  runInterfaceSplitFlap(formStatus, 520, 0.55);
}

function runInterfaceSplitFlap(root, duration = 720, settleStart = 0.62) {
  if (animationsDisabled) return Promise.resolve();
  const targets = [
    ...markScrambleTargets(root),
  ].filter((element, index, all) => all.indexOf(element) === index);
  return Promise.all(
    targets.map((element, index) => {
      const isProjectLabel = element.matches(
        ".project-tile .control-label, .shortcut .control-label, .project-tree__row .control-label, .child-project .control-label",
      );
      return scrambleElement(element, duration, isProjectLabel ? 0 : (index % 8) * 12, settleStart);
    }),
  );
}

async function scrambleMediaElement(element, duration = 760) {
  if (animationsDisabled) return;
  if (element.hasAttribute("data-scroll-media-reveal")) return;
  const source = $("img, video", element);
  if (!source) return;
  if (source instanceof HTMLImageElement) {
    if (!source.complete) await waitForEvent(source, "load", 2500);
    if (source.decode) await source.decode().catch(() => {});
  } else if (source.readyState < 2) {
    await waitForEvent(source, "loadeddata", 2500);
  }

  await animateMediaRevealSnapshot(element, source, duration);
}

function cleanupMediaScrambles() {
  $$('.media-scramble-overlay').forEach((overlay) => overlay.remove());
  $$('[data-glitch-media] img, [data-glitch-media] video').forEach((source) => {
    source.style.removeProperty("opacity");
  });
}

function installSiteBorderGlyphs() {
  const site = $("#site");
  if (!site) return;

  const refresh = () => {
    const glyphCount = Math.max(1, Math.ceil(site.scrollHeight / 70) + 1);
    site.dataset.borderGlyphs = Array(glyphCount).fill("║").join("\n");
  };

  refresh();
  new ResizeObserver(refresh).observe(site);
}

async function initialize() {
  await document.fonts.ready;
  await loadSiteContent();
  installBackgroundAudioPlayer();
  renderProjectNavigation();
  renderHomepage();
  renderBlog();
  renderRevealBenchmark();
  renderContact();
  installSiteBorderGlyphs();
  startLegacyTransmissions();
  startGlyphNoise();
  resizePointerGlitchCanvas();
  $$('[data-window]').forEach(installWindowBehavior);
  markScrambleTargets($("#site"));
  const initialUrl = new URL(window.location.href);
  const initialView = initialUrl.searchParams.get("view") || "grid";
  applyView(initialView);
  applyPage(initialUrl.searchParams.get("page") || "home", "replace");
  if (initialUrl.searchParams.get("sent") === "1") {
    $("#contact-form-status").textContent = "MESSAGE RECEIVED / I WILL GET BACK TO YOU";
  }
  updateMobileProjectInset();

  $$('[data-view-button]').forEach((button) => {
    button.addEventListener("click", () => transitionView(button.dataset.viewButton));
  });
  $$('[data-page-button]').forEach((button) => {
    button.addEventListener("click", () => transitionPage(button.dataset.pageButton));
  });
  $("#contact-form").addEventListener("submit", (event) => {
    submitContactForm(event).catch((error) => {
      $("#contact-form-status").textContent = `TRANSMISSION FAILED / ${error.message.toUpperCase()}`;
    });
  });
  window.addEventListener("popstate", () => {
    reconcileLocation().catch((error) => console.warn("Could not restore URL state.", error));
  });

  await reconcileLocation({ initial: true });

  document.addEventListener("click", (event) => {
    const fullscreenDirection = event.target.closest("[data-fullscreen-direction]");
    if (fullscreenDirection) {
      event.preventDefault();
      activateFullscreenMediaControl(fullscreenDirection);
      return;
    }
    const fullscreenStage = event.target.closest(".project-window[data-layout='media-fullscreen']:not([data-closing='true']) .project-stage");
    if (fullscreenStage) {
      event.preventDefault();
      closeProjectWindow(fullscreenStage.closest(".project-window"));
      return;
    }
    const home = event.target.closest("[data-home-link]");
    if (home) {
      event.preventDefault();
      resetHome();
      return;
    }
    const closeOsControl = event.target.closest("[data-close-os-window]");
    if (closeOsControl) {
      event.preventDefault();
      closeOsWindow(closeOsControl.closest("[data-os-window]"));
      return;
    }
    const aboutTarget = event.target.closest("[data-about-target]");
    if (aboutTarget) {
      event.preventDefault();
      const target = aboutTarget.dataset.aboutTarget;
      if (target === "contact") {
        transitionPage("contact");
      } else {
        const destination = $(`#about-${target}`);
        destination?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      }
      return;
    }
    const osFile = event.target.closest("[data-open-os-window]");
    if (osFile) {
      event.preventDefault();
      openOsWindow(osFile.dataset.openOsWindow);
      return;
    }
    const manifestFile = event.target.closest("[data-reveal-manifest]");
    if (manifestFile) {
      event.preventDefault();
      revealManifestDescent(manifestFile);
      return;
    }
    const costcoFile = event.target.closest("[data-reveal-costco]");
    if (costcoFile) {
      event.preventDefault();
      cueCostcoDescent(costcoFile);
      return;
    }
    const easterEggFile = event.target.closest("#easter-egg-file");
    if (easterEggFile) {
      event.preventDefault();
      revealOffscreenEgg();
      return;
    }
    const projectButton = event.target.closest("[data-open-project]");
    if (projectButton) openProject(projectButton.dataset.openProject, projectButton);
  });

  document.addEventListener("keydown", (event) => {
    const projectTrigger = event.target.closest?.("[data-open-project]");
    if (projectTrigger && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openProject(projectTrigger.dataset.openProject, projectTrigger);
      return;
    }
    const fullscreenDirection = event.target.closest?.("[data-fullscreen-direction]");
    if (fullscreenDirection && ["Enter", " "].includes(event.key)) {
      event.preventDefault();
      activateFullscreenMediaControl(fullscreenDirection);
      return;
    }
    const fullscreenWindow = $(".project-window[data-layout='media-fullscreen']:not([data-closing='true'])");
    if (fullscreenWindow && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      navigateFullscreenMedia(fullscreenWindow, event.key === "ArrowLeft" ? "previous" : "next");
      return;
    }
    if (event.key !== "Escape" || event.repeat) return;
    const windowElement = topProjectWindow();
    if (!windowElement) {
      const staticWindow = topOsWindow();
      if (!staticWindow) return;
      event.preventDefault();
      closeOsWindow(staticWindow);
      return;
    }
    event.preventDefault();
    closeProjectWindow(windowElement);
  });

  document.addEventListener("pointerover", (event) => {
    const control = event.target.closest("a, button");
    if (!control || control.matches("[data-static-control]") || control.contains(event.relatedTarget)) return;
    beginInteractiveGlitch(control);
  });
  document.addEventListener("pointerout", (event) => {
    const control = event.target.closest("a, button");
    if (!control || control.matches("[data-static-control]") || control.contains(event.relatedTarget)) return;
    endInteractiveGlitch(control);
  });
  document.addEventListener("focusin", (event) => {
    const control = event.target.closest("a, button");
    if (control && !control.matches("[data-static-control]")) beginInteractiveGlitch(control);
  });
  document.addEventListener("focusout", (event) => {
    const control = event.target.closest("a, button");
    if (control && !control.matches("[data-static-control]")) endInteractiveGlitch(control);
  });

  $("#cheat-code-toggle").addEventListener("click", toggleCheatCode);
  if (window.matchMedia("(pointer: fine)").matches) {
    document.documentElement.classList.add("has-glyph-cursor");
  }
  window.addEventListener("pointermove", (event) => {
    handlePointerGlitch(event);
    updateGlyphCursor(event);
  }, { passive: true });
  window.addEventListener("pointerdown", (event) => {
    if (event.button === 0) animateGlyphCursor();
  });
  document.documentElement.addEventListener("mouseleave", () => {
    $("#glyph-cursor")?.classList.remove("is-visible");
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (mobileGridOnly() && document.body.dataset.view !== "grid") applyView("grid");
      drawGlyphNoise();
      resizePointerGlitchCanvas();
      updateMobileProjectInset();
      $$(".project-window").forEach((windowElement) => fitProjectWindowToWorkspace(windowElement));
      refreshWindowEdges();
    }, 120);
  });

  if (animationsDisabled || bootDisabled) {
    state.bootRun += 1;
    finishBoot(state.bootRun);
  } else {
    runBoot();
  }
}

initialize();
