/**
 * Detective Mind: Narrative Mystery Cases
 * 
 * 20 cases across 3 difficulty tiers:
 * - Easy (tier 1): 3-4 sentences, literal questions, 3 options
 * - Medium (tier 2): 4-5 sentences, inference/causality, 4 options
 * - Hard (tier 3): 5-6 sentences, prediction/figurative, 4 options
 * 
 * Each case has exactly 1 question for clean trial-based scoring.
 */

export type QuestionType = 'literal' | 'inference' | 'cause_effect' | 'prediction' | 'figurative';

export interface DetectiveCase {
  id: string;
  title: string;
  tier: 1 | 2 | 3;
  story: string[];
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  questionType: QuestionType;
  /** Index of the sentence containing key evidence for hint highlighting */
  hintSentenceIndex: number;
}

export const DETECTIVE_CASES: DetectiveCase[] = [
  // ============ TIER 1: EASY (literal, 3-4 sentences, 3 options) ============
  {
    id: 'case-01',
    title: 'The Wet Floor',
    tier: 1,
    story: [
      'Maria came home and saw water on the kitchen floor.',
      'The sink faucet was running.',
      'Her cat was sitting on the counter looking guilty.',
    ],
    question: 'What caused the water on the floor?',
    options: ['The faucet was left running', 'It rained inside', 'Maria spilled her drink'],
    correctIndex: 0,
    explanation: 'The story says the sink faucet was running, which caused the water.',
    questionType: 'literal',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-02',
    title: 'The Missing Lunch',
    tier: 1,
    story: [
      'David put his sandwich in the fridge at work.',
      'At noon, he opened the fridge.',
      'The sandwich was gone.',
      'His coworker had crumbs on his shirt.',
    ],
    question: 'Who most likely took the sandwich?',
    options: ['His boss', 'His coworker', 'The cleaning staff'],
    correctIndex: 1,
    explanation: 'The coworker had crumbs on his shirt — a clue that he ate it.',
    questionType: 'literal',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-03',
    title: 'The Broken Vase',
    tier: 1,
    story: [
      'There was a broken vase on the living room floor.',
      'A baseball was lying next to it.',
      'The window was open.',
    ],
    question: 'What probably broke the vase?',
    options: ['An earthquake', 'A baseball came through the window', 'The cat knocked it over'],
    correctIndex: 1,
    explanation: 'The baseball next to the vase and the open window tell us the ball came in and broke it.',
    questionType: 'literal',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-04',
    title: 'The Late Bus',
    tier: 1,
    story: [
      'Emma was standing at the bus stop.',
      'It was snowing heavily.',
      'She had been waiting for 30 minutes.',
      'The roads were covered in ice.',
    ],
    question: 'Why is the bus late?',
    options: ['The driver is on vacation', 'The bad weather slowed it down', 'Emma is at the wrong stop'],
    correctIndex: 1,
    explanation: 'Heavy snow and icy roads would slow down the bus.',
    questionType: 'cause_effect',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-05',
    title: 'The Barking Dog',
    tier: 1,
    story: [
      'The dog started barking loudly at night.',
      'Someone was walking near the fence.',
      'The motion light turned on outside.',
    ],
    question: 'Why did the dog bark?',
    options: ['It was hungry', 'Someone was near the house', 'It heard thunder'],
    correctIndex: 1,
    explanation: 'The person near the fence triggered the motion light and the barking.',
    questionType: 'cause_effect',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-06',
    title: 'The Empty Bowl',
    tier: 1,
    story: [
      'Mom put cookies on the table.',
      'She left the room for five minutes.',
      'When she came back, the bowl was empty.',
      'Her son had chocolate on his face.',
    ],
    question: 'Who ate the cookies?',
    options: ['Mom ate them herself', 'Her son ate them', 'The dog ate them'],
    correctIndex: 1,
    explanation: 'The chocolate on her son\'s face is a clear clue.',
    questionType: 'literal',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-07',
    title: 'The Flat Tire',
    tier: 1,
    story: [
      'John drove over something sharp on the road.',
      'He heard a loud pop.',
      'The car started pulling to one side.',
    ],
    question: 'What happened to the car?',
    options: ['The engine broke', 'A tire went flat', 'It ran out of gas'],
    correctIndex: 1,
    explanation: 'Driving over something sharp, a pop sound, and pulling to one side = flat tire.',
    questionType: 'literal',
    hintSentenceIndex: 0,
  },

  // ============ TIER 2: MEDIUM (inference/causality, 4-5 sentences, 4 options) ============
  {
    id: 'case-08',
    title: 'The Nervous Sister',
    tier: 2,
    story: [
      'Tom walked into the kitchen and saw broken glass on the floor.',
      'The window was open.',
      'His dog was wagging its tail.',
      'His sister looked nervous.',
    ],
    question: 'Who likely broke the glass?',
    options: ['Tom', 'The dog', 'His sister', 'A stranger'],
    correctIndex: 2,
    explanation: 'The sister looks nervous — she likely did something wrong. The dog is happy, not guilty.',
    questionType: 'inference',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-09',
    title: 'The Secret Gift',
    tier: 2,
    story: [
      'Lisa found flowers on her desk when she arrived at work.',
      'There was no card attached.',
      'Her friend Mark smiled and quickly looked away when she asked about them.',
      'Nobody else was in the office before Lisa arrived.',
    ],
    question: 'Who most likely left the flowers?',
    options: ['A delivery service', 'Mark', 'Lisa\'s boss', 'A stranger'],
    correctIndex: 1,
    explanation: 'Mark smiled and looked away — classic sign of someone hiding that they did something nice.',
    questionType: 'inference',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-10',
    title: 'The Canceled Game',
    tier: 2,
    story: [
      'The soccer field was completely muddy.',
      'Dark clouds covered the sky all morning.',
      'The coach sent a message to all parents.',
      'Kids were disappointed but stayed home.',
    ],
    question: 'Why did the kids stay home?',
    options: ['School was closed', 'The game was canceled due to weather', 'They didn\'t want to play', 'The coach was sick'],
    correctIndex: 1,
    explanation: 'Muddy field + dark clouds + coach message = game canceled because of bad weather.',
    questionType: 'cause_effect',
    hintSentenceIndex: 0,
  },
  {
    id: 'case-11',
    title: 'The Locked Room',
    tier: 2,
    story: [
      'The jewelry box in the locked room was empty.',
      'The window had no signs of being forced open.',
      'Only two people had the key: the owner and the housekeeper.',
      'The housekeeper called in sick that day but was seen downtown.',
      'The owner was on vacation.',
    ],
    question: 'Who is the prime suspect?',
    options: ['A burglar', 'The owner', 'The housekeeper', 'A neighbor'],
    correctIndex: 2,
    explanation: 'The housekeeper lied about being sick, has a key, and no break-in occurred.',
    questionType: 'inference',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-12',
    title: 'The Changed Recipe',
    tier: 2,
    story: [
      'Grandma\'s cake tasted different this year.',
      'She couldn\'t find her reading glasses.',
      'The sugar container was next to the salt container.',
      'Both containers look exactly the same.',
    ],
    question: 'What probably went wrong?',
    options: ['She used a new recipe', 'She mixed up sugar and salt', 'The oven was broken', 'She forgot an ingredient'],
    correctIndex: 1,
    explanation: 'Without glasses, identical containers side by side — she likely grabbed salt instead of sugar.',
    questionType: 'inference',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-13',
    title: 'The Morning Rush',
    tier: 2,
    story: [
      'Sarah\'s alarm didn\'t go off this morning.',
      'She skipped breakfast and grabbed her keys.',
      'She drove faster than usual.',
      'She arrived at work with her shirt inside out.',
    ],
    question: 'Why was Sarah\'s shirt inside out?',
    options: ['It\'s a fashion trend', 'She got dressed in a rush', 'Someone played a prank', 'She wore it that way on purpose'],
    correctIndex: 1,
    explanation: 'The alarm didn\'t go off → she rushed → dressed too quickly → shirt inside out.',
    questionType: 'cause_effect',
    hintSentenceIndex: 0,
  },

  // ============ TIER 3: HARD (prediction/figurative, 5-6 sentences, 4 options) ============
  {
    id: 'case-14',
    title: 'The Interview',
    tier: 3,
    story: [
      'Jake practiced his answers for three days.',
      'He wore his best suit and arrived 15 minutes early.',
      'The interviewer smiled and said, "We\'ll be in touch."',
      'Two other candidates left looking stressed.',
      'Jake received a phone call the next morning.',
    ],
    question: 'What most likely happened?',
    options: ['He got rejected', 'He got the job', 'The company closed', 'They lost his application'],
    correctIndex: 1,
    explanation: 'Good preparation + confidence + quick callback = likely got the job.',
    questionType: 'prediction',
    hintSentenceIndex: 4,
  },
  {
    id: 'case-15',
    title: 'The New Neighbor',
    tier: 3,
    story: [
      'A moving truck arrived next door.',
      'The new neighbor carried in many boxes of books.',
      'She set up a desk near the window first thing.',
      'A university parking sticker was on her car.',
      'She introduced herself as "Professor Chen."',
    ],
    question: 'What can you predict about the new neighbor\'s daily routine?',
    options: [
      'She probably works at a restaurant',
      'She likely teaches and does research at a university',
      'She is probably retired',
      'She probably works from home as an artist',
    ],
    correctIndex: 1,
    explanation: 'Books, a desk, university sticker, and "Professor" title all point to academic work.',
    questionType: 'prediction',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-16',
    title: 'The Storm Warning',
    tier: 3,
    story: [
      'The weather report warned of a severe storm.',
      'Mr. Garcia boarded up his windows.',
      'He filled the bathtub with water.',
      'He bought batteries, canned food, and a radio.',
      'His neighbors laughed and said he was overreacting.',
      'The power went out that night.',
    ],
    question: 'What will likely happen to the neighbors compared to Mr. Garcia?',
    options: [
      'The neighbors will be fine',
      'Mr. Garcia will be better prepared than his neighbors',
      'Everyone will be equally affected',
      'Mr. Garcia wasted his time',
    ],
    correctIndex: 1,
    explanation: 'Mr. Garcia prepared while neighbors didn\'t — when the power went out, he was ready.',
    questionType: 'prediction',
    hintSentenceIndex: 4,
  },
  {
    id: 'case-17',
    title: 'Breaking the Ice',
    tier: 3,
    story: [
      'It was Amy\'s first day at a new company.',
      'Everyone in the break room was talking in small groups.',
      'Amy told a funny story about her commute.',
      'People started laughing and introducing themselves.',
      'By lunch, she had been invited to join three different groups.',
    ],
    question: 'The story says Amy "broke the ice." What does that mean?',
    options: [
      'She broke something frozen in the break room',
      'She made people feel comfortable and started conversations',
      'She created problems on her first day',
      'She made the room colder',
    ],
    correctIndex: 1,
    explanation: '"Breaking the ice" means making people feel comfortable — Amy did this with humor.',
    questionType: 'figurative',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-18',
    title: 'The Last Straw',
    tier: 3,
    story: [
      'The restaurant got Mike\'s order wrong for the third time.',
      'The waiter spilled water on his jacket.',
      'Then they charged him for food he didn\'t order.',
      'Mike stood up, left money on the table, and walked out.',
      'He never went back to that restaurant again.',
    ],
    question: 'What was "the last straw" for Mike?',
    options: [
      'He found a straw on the floor',
      'The wrong charge was the final thing that made him give up',
      'He ran out of straws for his drink',
      'The waiter took his straw away',
    ],
    correctIndex: 1,
    explanation: '"The last straw" means the final problem that pushes someone over the edge.',
    questionType: 'figurative',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-19',
    title: 'The Disappearing Act',
    tier: 3,
    story: [
      'Karen\'s coworker always volunteered for new projects.',
      'But when the hard work started, he was never around.',
      'He always had an excuse: a meeting, a phone call, a dentist appointment.',
      'Other team members had to finish his work.',
      'The boss started noticing the pattern.',
    ],
    question: 'What will the boss most likely do?',
    options: [
      'Give the coworker a promotion',
      'Confront the coworker about not doing his share',
      'Ignore the problem',
      'Fire Karen instead',
    ],
    correctIndex: 1,
    explanation: 'The boss noticed the pattern of avoiding work — they\'ll likely address it.',
    questionType: 'prediction',
    hintSentenceIndex: 4,
  },
  {
    id: 'case-20',
    title: 'The Silent Treatment',
    tier: 3,
    story: [
      'Ben forgot his wife\'s birthday.',
      'When he came home, the house was unusually quiet.',
      'Dinner wasn\'t made, and his wife was reading in the bedroom.',
      'She answered his questions with one-word replies.',
      'A calendar on the fridge had today\'s date circled with a heart.',
    ],
    question: 'Why is Ben\'s wife giving him the "silent treatment"?',
    options: [
      'She\'s tired from work',
      'She\'s upset because he forgot her birthday',
      'She doesn\'t feel well',
      'She\'s focused on her book',
    ],
    correctIndex: 1,
    explanation: 'The circled date with a heart + cold behavior = she\'s hurt he forgot her birthday.',
    questionType: 'inference',
    hintSentenceIndex: 4,
  },

  // ============ TIER 1 EXPANSION (literal / cause_effect, 3-4 sentences, 3 options) ============
  {
    id: 'case-21',
    title: 'The Burnt Toast',
    tier: 1,
    story: [
      'Anna put bread in the toaster.',
      'She got distracted by a phone call.',
      'Smoke started coming out of the toaster.',
    ],
    question: 'Why is the toast burning?',
    options: ['She left it in too long', 'The bread was old', 'The toaster was unplugged'],
    correctIndex: 0,
    explanation: 'She got distracted and forgot the toast — it stayed in too long.',
    questionType: 'cause_effect',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-22',
    title: 'The Wet Dog',
    tier: 1,
    story: [
      'Max came inside soaking wet.',
      'It was raining hard outside.',
      'His owner had let him out ten minutes ago.',
    ],
    question: 'Why is Max wet?',
    options: ['He jumped in the bath', 'He was outside in the rain', 'He drank too much water'],
    correctIndex: 1,
    explanation: 'Max was outside while it was raining hard.',
    questionType: 'literal',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-23',
    title: 'The Empty Gas Tank',
    tier: 1,
    story: [
      'The car slowed down on the highway.',
      'The fuel needle pointed to E.',
      'The engine stopped.',
    ],
    question: 'Why did the car stop?',
    options: ['It ran out of gas', 'A tire popped', 'The driver turned it off'],
    correctIndex: 0,
    explanation: 'The needle on E means empty — the car ran out of gas.',
    questionType: 'literal',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-24',
    title: 'The Crying Baby',
    tier: 1,
    story: [
      'The baby started crying loudly.',
      'It had been four hours since her last bottle.',
      'Mom went to warm up some milk.',
    ],
    question: 'Why is the baby crying?',
    options: ['She is sleepy', 'She is hungry', 'She is cold'],
    correctIndex: 1,
    explanation: 'It has been a long time since her last bottle — she is hungry.',
    questionType: 'cause_effect',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-25',
    title: 'The Loud Music',
    tier: 1,
    story: [
      'The neighbors were having a party.',
      'Music was playing very loud at midnight.',
      'Sam could not fall asleep.',
    ],
    question: 'Why can\'t Sam sleep?',
    options: ['The room is too hot', 'The music is too loud', 'He drank coffee'],
    correctIndex: 1,
    explanation: 'Loud music at midnight is keeping Sam awake.',
    questionType: 'cause_effect',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-26',
    title: 'The Open Umbrella',
    tier: 1,
    story: [
      'Tina left the house with an umbrella.',
      'Dark clouds covered the sky.',
      'She opened the umbrella as she stepped outside.',
    ],
    question: 'Why did Tina open her umbrella?',
    options: ['It was sunny', 'It was raining or about to rain', 'It was windy'],
    correctIndex: 1,
    explanation: 'Dark clouds and opening an umbrella mean rain is coming.',
    questionType: 'literal',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-27',
    title: 'The Cold House',
    tier: 1,
    story: [
      'The house felt very cold this morning.',
      'The thermostat was turned off.',
      'A window in the living room was wide open.',
    ],
    question: 'Why is the house so cold?',
    options: ['The fridge is broken', 'The heat is off and a window is open', 'It is summer'],
    correctIndex: 1,
    explanation: 'No heat plus an open window let cold air in.',
    questionType: 'cause_effect',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-28',
    title: 'The Empty Driveway',
    tier: 1,
    story: [
      'Dad usually parks his car in the driveway.',
      'This morning the driveway is empty.',
      'A note on the table says "Gone to work early."',
    ],
    question: 'Where is Dad?',
    options: ['He is asleep', 'He went to work', 'He is in the garage'],
    correctIndex: 1,
    explanation: 'The note says he left for work early.',
    questionType: 'literal',
    hintSentenceIndex: 2,
  },

  // ============ TIER 2 EXPANSION (inference / cause_effect, 4-5 sentences, 4 options) ============
  {
    id: 'case-29',
    title: 'The Silent Phone',
    tier: 2,
    story: [
      'Rachel had texted her sister three times.',
      'No reply had come for two days.',
      'Her sister\'s phone went straight to voicemail.',
      'Rachel saw on social media that her sister was on a hiking trip.',
    ],
    question: 'Why hasn\'t Rachel\'s sister replied?',
    options: ['She is angry at Rachel', 'She likely has no phone signal on the hike', 'Her phone was stolen', 'She blocked Rachel'],
    correctIndex: 1,
    explanation: 'Hiking trips often have no signal, which explains the silence.',
    questionType: 'inference',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-30',
    title: 'The Quiet Classroom',
    tier: 2,
    story: [
      'The teacher walked into a normally noisy classroom.',
      'Every student was sitting silently and looking down.',
      'A broken globe was hidden behind the desk.',
      'Two students glanced at each other quickly.',
    ],
    question: 'What likely happened before the teacher arrived?',
    options: [
      'The students were studying quietly',
      'Two students broke the globe and the class is hiding it',
      'A test had just ended',
      'The lights had gone out',
    ],
    correctIndex: 1,
    explanation: 'Hidden broken globe + nervous glances = the two students broke it.',
    questionType: 'inference',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-31',
    title: 'The Late Delivery',
    tier: 2,
    story: [
      'Carlos ordered a package for next-day delivery.',
      'A snowstorm closed the highways overnight.',
      'The tracking page kept saying "in transit."',
      'Three days later the package finally arrived.',
    ],
    question: 'Why was the package late?',
    options: ['Carlos gave the wrong address', 'The storm delayed the trucks', 'The seller forgot to ship it', 'The package was lost'],
    correctIndex: 1,
    explanation: 'Closed highways from the storm delayed delivery.',
    questionType: 'cause_effect',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-32',
    title: 'The Surprise Party',
    tier: 2,
    story: [
      'Olivia\'s friends suddenly stopped texting her this week.',
      'Her best friend asked odd questions about her schedule on Saturday.',
      'She noticed balloons hidden in her friend\'s car.',
      'Saturday\'s plans were vague and kept changing.',
    ],
    question: 'What is most likely happening on Saturday?',
    options: ['Her friends are avoiding her', 'A surprise party is being planned for her', 'She is being asked to help move', 'Her friends are going on a trip without her'],
    correctIndex: 1,
    explanation: 'Hidden balloons + secrecy + schedule questions = surprise party.',
    questionType: 'inference',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-33',
    title: 'The Empty Stadium',
    tier: 2,
    story: [
      'The big game was scheduled for 7 PM.',
      'At 6:45 the parking lot was nearly empty.',
      'A radio announcer kept apologizing to fans.',
      'Thunder rumbled in the distance.',
    ],
    question: 'Why is the stadium empty?',
    options: [
      'The team moved cities',
      'The game was likely postponed because of the storm',
      'Nobody likes the team',
      'Tickets were too expensive',
    ],
    correctIndex: 1,
    explanation: 'Thunder + apologies on the radio + empty lot = game postponed.',
    questionType: 'inference',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-34',
    title: 'The Tired Driver',
    tier: 2,
    story: [
      'Henry had worked a double shift at the hospital.',
      'On the drive home he kept rubbing his eyes.',
      'He pulled into a rest stop and reclined his seat.',
      'He set an alarm on his phone for 30 minutes.',
    ],
    question: 'Why did Henry stop at the rest stop?',
    options: ['To get gas', 'To take a short nap before continuing', 'To make a phone call', 'To check directions'],
    correctIndex: 1,
    explanation: 'Tired eyes + reclining + short alarm = he is taking a quick nap.',
    questionType: 'inference',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-35',
    title: 'The Smoke Alarm',
    tier: 2,
    story: [
      'A loud beeping woke the family at 3 AM.',
      'There was no smoke or heat anywhere in the house.',
      'The alarm had been beeping every few months for a year.',
      'Dad climbed up with a small 9-volt battery.',
    ],
    question: 'Why is the smoke alarm beeping?',
    options: ['There is a fire', 'The battery is dying', 'A burglar set it off', 'It is broken forever'],
    correctIndex: 1,
    explanation: 'No smoke + periodic chirping + Dad with a battery = low battery alert.',
    questionType: 'inference',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-36',
    title: 'The Closed Cafe',
    tier: 2,
    story: [
      'Maya went to her favorite cafe on Tuesday morning.',
      'The lights were off and the door was locked.',
      'A handwritten sign was taped inside the window.',
      'Other shops on the same street were open as usual.',
    ],
    question: 'Why is only the cafe closed?',
    options: [
      'The whole street has no power',
      'The cafe is closed for a private reason, like a holiday or repairs',
      'The cafe went out of business years ago',
      'It is a national holiday',
    ],
    correctIndex: 1,
    explanation: 'Other shops are open, so the closure is specific to this one cafe.',
    questionType: 'inference',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-37',
    title: 'The Unfinished Homework',
    tier: 2,
    story: [
      'Tyler\'s math homework was due first thing Monday.',
      'On Sunday night his tablet battery had died.',
      'The charger had been left at his dad\'s house.',
      'Monday morning he walked into class with empty hands.',
    ],
    question: 'Why did Tyler not finish his homework?',
    options: ['He forgot it existed', 'He could not charge his tablet to do it', 'The teacher canceled it', 'He was sick all weekend'],
    correctIndex: 1,
    explanation: 'No charger → tablet died → could not finish digital homework.',
    questionType: 'cause_effect',
    hintSentenceIndex: 2,
  },

  // ============ TIER 3 EXPANSION (prediction / figurative, 5-6 sentences, 4 options) ============
  {
    id: 'case-38',
    title: 'Spilling the Beans',
    tier: 3,
    story: [
      'The team had planned a surprise retirement party for their manager.',
      'Only five people knew about it.',
      'In a meeting, one team member said "We\'ll miss you so much next month!"',
      'The manager looked confused and asked what she meant.',
      'Everyone else froze and stared at the floor.',
    ],
    question: 'The team member "spilled the beans." What does that mean?',
    options: [
      'She knocked over a bowl of food',
      'She accidentally revealed the secret',
      'She started a food fight',
      'She quit her job suddenly',
    ],
    correctIndex: 1,
    explanation: '"Spilling the beans" means accidentally revealing a secret.',
    questionType: 'figurative',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-39',
    title: 'The Marathon Training',
    tier: 3,
    story: [
      'Priya started running short distances three months ago.',
      'She slowly added a mile to her route every week.',
      'She tracked her pace and rest days carefully.',
      'Her shoes are nearly worn out from daily training.',
      'The city marathon is in two weeks.',
      'Her coach told her she is ready.',
    ],
    question: 'What will most likely happen on race day?',
    options: [
      'She will give up before starting',
      'She will probably finish the marathon',
      'She will get lost on the course',
      'She will run a different race',
    ],
    correctIndex: 1,
    explanation: 'Months of structured training + coach approval = she is ready to finish.',
    questionType: 'prediction',
    hintSentenceIndex: 5,
  },
  {
    id: 'case-40',
    title: 'Burning the Midnight Oil',
    tier: 3,
    story: [
      'Daniel had a major project due Friday morning.',
      'For four nights in a row his office light stayed on past 2 AM.',
      'Empty coffee cups piled up on his desk.',
      'His coworkers noticed dark circles under his eyes.',
      'He submitted a polished report on Friday at 8 AM.',
    ],
    question: 'Daniel was "burning the midnight oil." What does that mean?',
    options: [
      'He started a small fire at work',
      'He was working very late into the night',
      'He was wasting electricity',
      'He was taking long breaks',
    ],
    correctIndex: 1,
    explanation: '"Burning the midnight oil" means working late into the night.',
    questionType: 'figurative',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-41',
    title: 'The Empty Nest',
    tier: 3,
    story: [
      'For 20 years the Patel house was full of noise.',
      'Their two children just left for college in different states.',
      'Mrs. Patel keeps wandering into the empty bedrooms.',
      'Mr. Patel signed up for a pottery class on weekends.',
      'They started planning a long trip together for the spring.',
    ],
    question: 'What will most likely change in the Patels\' life this year?',
    options: [
      'They will go back to their old routines',
      'They will build new hobbies and activities as a couple',
      'They will move into their children\'s rooms',
      'They will stop talking to each other',
    ],
    correctIndex: 1,
    explanation: 'New class + planned trip = they are adapting by building new shared activities.',
    questionType: 'prediction',
    hintSentenceIndex: 4,
  },
  {
    id: 'case-42',
    title: 'Cold Feet',
    tier: 3,
    story: [
      'The wedding was set for Saturday at noon.',
      'On Friday night the groom kept pacing in his hotel room.',
      'He called his best friend three times to "just talk."',
      'He kept saying he loved his fiancée but was scared.',
      'In the morning he showed up at the church.',
    ],
    question: 'The groom had "cold feet." What does that mean?',
    options: [
      'His feet were physically freezing',
      'He felt sudden fear about a big commitment',
      'He needed warmer shoes',
      'He had a fever',
    ],
    correctIndex: 1,
    explanation: '"Cold feet" means sudden nervousness before a big commitment.',
    questionType: 'figurative',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-43',
    title: 'The Failing Garden',
    tier: 3,
    story: [
      'Ed planted tomatoes in a shady corner of the yard.',
      'He watered them every single day, sometimes twice.',
      'Yellow leaves appeared after one week.',
      'The soil never seemed to dry out.',
      'A gardening book on his shelf describes "root rot from overwatering."',
    ],
    question: 'What will likely happen if Ed keeps watering twice a day?',
    options: [
      'The plants will grow faster',
      'The plants will keep dying from too much water',
      'The plants will start producing fruit',
      'Nothing will change',
    ],
    correctIndex: 1,
    explanation: 'Wet soil + yellow leaves + a book on overwatering = he is killing them by overwatering.',
    questionType: 'prediction',
    hintSentenceIndex: 4,
  },
  {
    id: 'case-44',
    title: 'A Piece of Cake',
    tier: 3,
    story: [
      'Lena had been a professional pianist for 20 years.',
      'Her recital piece this month was one she had played hundreds of times.',
      'A new student asked if the piece was hard.',
      'Lena smiled and said, "For me, it\'s a piece of cake."',
      'She walked on stage looking calm and relaxed.',
    ],
    question: 'When Lena said "a piece of cake," she meant the piece is:',
    options: [
      'Made of dessert',
      'Very easy for her',
      'Extremely difficult',
      'About food',
    ],
    correctIndex: 1,
    explanation: '"A piece of cake" means something very easy.',
    questionType: 'figurative',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-45',
    title: 'The Quiet Resignation',
    tier: 3,
    story: [
      'Marcus had been unhappy at his job for over a year.',
      'He quietly updated his resume in the evenings.',
      'He started taking long lunch breaks for "appointments."',
      'He smiled more than usual at his desk this week.',
      'On Friday he asked his manager for a private meeting at 4 PM.',
    ],
    question: 'What will most likely happen at the 4 PM meeting?',
    options: [
      'Marcus will ask for more work',
      'Marcus will resign from the company',
      'Marcus will request vacation time',
      'Marcus will complain about a coworker',
    ],
    correctIndex: 1,
    explanation: 'Resume updates + interviews disguised as appointments + relief = he is quitting.',
    questionType: 'prediction',
    hintSentenceIndex: 4,
  },

  // ============================================================
  // Phase 5 top-up — +5 per tier to lift each tier from 15 → 20.
  // ============================================================

  // --- Tier 1 additions ---
  {
    id: 'case-46',
    title: 'The Wet Umbrella',
    tier: 1,
    story: [
      'Lena walked into the office holding a closed umbrella.',
      'The umbrella was dripping water onto the floor.',
      'Her coat was speckled with raindrops.',
    ],
    question: 'What is the weather like outside?',
    options: ['It is sunny', 'It is raining', 'It is snowing'],
    correctIndex: 1,
    explanation: 'A dripping umbrella and a wet coat tell us it is raining.',
    questionType: 'literal',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-47',
    title: 'The Burnt Toast',
    tier: 1,
    story: [
      'Smoke was rising from the toaster.',
      'Two slices of black toast popped up.',
      'Jamal was on the phone in the next room.',
    ],
    question: 'Why did the toast burn?',
    options: ['The toaster was broken', 'Jamal forgot about it', 'The bread was old'],
    correctIndex: 1,
    explanation: 'Jamal was distracted on the phone and did not check the toaster.',
    questionType: 'literal',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-48',
    title: 'The Empty Bowl',
    tier: 1,
    story: [
      'The dog\'s food bowl was empty and licked clean.',
      'The dog was wagging her tail at the door.',
      'Her water bowl was also empty.',
    ],
    question: 'What does the dog probably want?',
    options: ['To go to sleep', 'To be fed and given water', 'To play fetch'],
    correctIndex: 1,
    explanation: 'Both bowls are empty, so she likely wants food and water.',
    questionType: 'literal',
    hintSentenceIndex: 0,
  },
  {
    id: 'case-49',
    title: 'The Locked Door',
    tier: 1,
    story: [
      'Priya pulled hard on the front door handle.',
      'The door would not open.',
      'She remembered her keys were still on the kitchen table inside.',
    ],
    question: 'Why can\'t Priya get in?',
    options: ['The door is broken', 'She is locked out without her keys', 'Someone is blocking it'],
    correctIndex: 1,
    explanation: 'Her keys are inside and the door is locked.',
    questionType: 'literal',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-50',
    title: 'The Loud Crash',
    tier: 1,
    story: [
      'Tom heard a loud crash from the garage.',
      'He ran in and saw bicycles knocked over on the floor.',
      'The garage door was swinging in the wind.',
    ],
    question: 'What caused the crash?',
    options: ['A burglar', 'The wind blew the door and knocked the bikes', 'An earthquake'],
    correctIndex: 1,
    explanation: 'The swinging door and fallen bikes point to wind.',
    questionType: 'literal',
    hintSentenceIndex: 2,
  },

  // --- Tier 2 additions ---
  {
    id: 'case-51',
    title: 'The Cold Coffee',
    tier: 2,
    story: [
      'Sara poured a fresh cup of coffee at 8 AM.',
      'Her boss called her into an urgent meeting.',
      'The meeting lasted two hours.',
      'When she returned, the coffee was on her desk untouched.',
    ],
    question: 'Why is the coffee cold?',
    options: [
      'Sara forgot to add hot water',
      'It sat for two hours during the meeting',
      'The coffee maker was broken',
      'Someone replaced it with iced coffee',
    ],
    correctIndex: 1,
    explanation: 'Hot coffee left alone for two hours cools down.',
    questionType: 'cause_effect',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-52',
    title: 'The Quiet Classroom',
    tier: 2,
    story: [
      'Ms. Patel walked into her usually noisy classroom.',
      'Every student was sitting silently with eyes on a paper.',
      'A clock at the front was counting down.',
      'No one looked up when she entered.',
    ],
    question: 'What is happening in the classroom?',
    options: [
      'The students are watching a movie',
      'The students are taking a test',
      'The students are at recess',
      'The students are sleeping',
    ],
    correctIndex: 1,
    explanation: 'Silence, focus on paper, and a countdown clock indicate a test.',
    questionType: 'inference',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-53',
    title: 'The Soggy Mail',
    tier: 2,
    story: [
      'Carlos opened his mailbox after work.',
      'Every envelope inside was soft and damp.',
      'The bottom of the mailbox had a small pool of water.',
      'It had stormed heavily that afternoon.',
    ],
    question: 'Why is the mail wet?',
    options: [
      'The mail carrier dropped it in a puddle',
      'Rain leaked into the mailbox during the storm',
      'Carlos spilled water on it',
      'The envelopes were sweating',
    ],
    correctIndex: 1,
    explanation: 'A pool of water in the mailbox after a storm means rain got in.',
    questionType: 'cause_effect',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-54',
    title: 'The Late Train',
    tier: 2,
    story: [
      'Amir checked the platform sign at 7:45 AM.',
      'His usual 7:30 train was still listed as "delayed."',
      'A crowd had built up along the platform.',
      'Other lines were running normally.',
    ],
    question: 'Why are so many people on the platform?',
    options: [
      'A festival is happening',
      'Riders are still waiting for the delayed train',
      'The station is closing',
      'They are tourists',
    ],
    correctIndex: 1,
    explanation: 'Only Amir\'s line is delayed, so its riders are stacking up.',
    questionType: 'inference',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-55',
    title: 'The Dropped Glass',
    tier: 2,
    story: [
      'Nina was carrying three glasses across the kitchen.',
      'Her son ran in chasing the dog.',
      'He bumped her arm hard.',
      'One of the glasses shattered on the tile.',
    ],
    question: 'Why did the glass break?',
    options: [
      'It was already cracked',
      'Her son bumped her and she dropped it',
      'The dog knocked it over',
      'Nina threw it',
    ],
    correctIndex: 1,
    explanation: 'The bump caused her to lose hold of one glass.',
    questionType: 'cause_effect',
    hintSentenceIndex: 2,
  },

  // --- Tier 3 additions ---
  {
    id: 'case-56',
    title: 'The Packed Suitcase',
    tier: 3,
    story: [
      'Elena had been quietly photographing each room of the house.',
      'Her suitcase had sat packed by the door for three days.',
      'She returned her library books a week early.',
      'She told the neighbor she would "miss the garden."',
      'Her flight confirmation sat open on the kitchen counter.',
    ],
    question: 'What is Elena most likely about to do?',
    options: [
      'Take a short weekend trip',
      'Move away from the house for good',
      'Visit family for the holidays',
      'Host out-of-town guests',
    ],
    correctIndex: 1,
    explanation: 'Photographing the home, returning books early, and saying she\'ll miss it together signal a permanent move.',
    questionType: 'prediction',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-57',
    title: 'The Old Friend\'s Call',
    tier: 3,
    story: [
      'After years of silence, Greg\'s old college friend called him.',
      'They chatted warmly for ten minutes about old times.',
      'Then his friend\'s tone shifted and he cleared his throat.',
      'He mentioned a "unique investment opportunity."',
      'He asked if Greg could wire a small amount today.',
    ],
    question: 'What is the friend most likely doing?',
    options: [
      'Inviting Greg to a reunion',
      'Asking Greg for money under a friendly cover',
      'Catching up with no agenda',
      'Offering Greg a job',
    ],
    correctIndex: 1,
    explanation: 'Long silence, warm warm-up, then a sudden pitch for money is a classic ask-disguised-as-catch-up.',
    questionType: 'prediction',
    hintSentenceIndex: 4,
  },
  {
    id: 'case-58',
    title: 'The Heavy Sky',
    tier: 3,
    story: [
      'Reggie watched the clouds turn the color of wet slate.',
      'The wind stopped completely.',
      'Birds went quiet in the trees.',
      'A neighbor pulled in her laundry in a hurry.',
      'Reggie said, "The sky is holding its breath."',
    ],
    question: 'What does Reggie mean by "the sky is holding its breath"?',
    options: [
      'The sky is calm and clear',
      'A storm is about to break',
      'The air is fresh and clean',
      'It is the middle of the night',
    ],
    correctIndex: 1,
    explanation: 'A held breath comes before a release — the figurative tension predicts the coming storm.',
    questionType: 'figurative',
    hintSentenceIndex: 4,
  },
  {
    id: 'case-59',
    title: 'The Empty Chair',
    tier: 3,
    story: [
      'At every Sunday dinner, Grandpa\'s chair sat at the head of the table.',
      'A year after he passed, the family still set his place.',
      'No one moved his napkin or his glass.',
      'Aunt Rosa said, "He is still pulling up a chair."',
      'Everyone nodded quietly.',
    ],
    question: 'What does Aunt Rosa mean?',
    options: [
      'Grandpa is hiding in another room',
      'Grandpa\'s memory is still present at the table',
      'The chair needs to be fixed',
      'They should invite a guest to sit there',
    ],
    correctIndex: 1,
    explanation: '"Pulling up a chair" figuratively means he is still emotionally present, not literally returning.',
    questionType: 'figurative',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-60',
    title: 'The Long Goodbye',
    tier: 3,
    story: [
      'Hana stayed an extra hour at the office on her last day.',
      'She walked slowly past each coworker\'s desk.',
      'She kept one framed photo and a coffee mug in a small box.',
      'At the elevator she turned and took one more look down the hallway.',
      'Then she pressed the button and did not look back.',
    ],
    question: 'What is Hana most likely feeling?',
    options: [
      'Excited and rushed to leave',
      'Reluctant but ready to move on',
      'Angry at her coworkers',
      'Confused about which floor to go to',
    ],
    correctIndex: 1,
    explanation: 'Slow farewell, keeping mementos, one last look — then forward — signals reluctant closure.',
    questionType: 'prediction',
    hintSentenceIndex: 3,
  },

  // ============ EXPANSION SET (launch content wave) ============
  // Calibrated to the tier conventions above and the computeDetectiveDifficulty
  // model: T1 = 3-4 sentences / literal / 3 options; T2 = 4-5 / cause-effect or
  // inference / 4 options; T3 = 5-6 / prediction-figurative / 4 options.
  // Flagged for SLP review like all bank content.
  {
    id: 'case-exp-01',
    title: 'The Burnt Toast',
    tier: 1,
    story: [
      'Sam put bread in the toaster and went to get the newspaper.',
      'He stayed outside talking to his neighbor.',
      'When he came back, the kitchen smelled like smoke.',
    ],
    question: 'Why did the kitchen smell like smoke?',
    options: ['The toast burned', 'The neighbor was smoking', 'The newspaper caught fire'],
    correctIndex: 0,
    explanation: 'Sam left the bread in the toaster too long while he talked, so it burned.',
    questionType: 'literal',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-exp-02',
    title: 'The Full Mailbox',
    tier: 1,
    story: [
      'Rosa went to check on her neighbor Mr. Lee.',
      'His mailbox was stuffed full of letters.',
      'The same lights had been on for three days.',
      'His car was still in the driveway.',
    ],
    question: 'What did Rosa see in the mailbox?',
    options: ['It was stuffed full of letters', 'It was empty', 'It had a package'],
    correctIndex: 0,
    explanation: 'The story says the mailbox was stuffed full of letters.',
    questionType: 'literal',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-exp-03',
    title: 'The Quiet Phone',
    tier: 2,
    story: [
      'Nina texted her friend Carla three times in the morning.',
      'Carla always answered within minutes.',
      'By dinner there was still no reply.',
      'Then Nina remembered Carla was flying to Denver today.',
    ],
    question: 'Why did Carla not answer?',
    options: [
      'Her phone was off during the flight',
      'She was angry at Nina',
      'She lost her phone',
      'She never got the texts',
    ],
    correctIndex: 0,
    explanation: 'Carla was on an airplane — phones are off or unreachable during flights.',
    questionType: 'cause_effect',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-exp-04',
    title: 'The Extra Plate',
    tier: 2,
    story: [
      'Grandpa set the table for four people like always.',
      'Then he added a fifth plate and the good napkins.',
      'He kept checking the window while the soup cooked.',
      'He had shaved and put on his nice sweater.',
    ],
    question: 'What is most likely true?',
    options: [
      'He is expecting a special guest',
      'He made a counting mistake',
      'He is selling the plates',
      'He is cold in the kitchen',
    ],
    correctIndex: 0,
    explanation: 'An extra place, good napkins, watching the window, dressing up — someone special is coming.',
    questionType: 'inference',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-exp-05',
    title: 'The Wilted Garden',
    tier: 2,
    story: [
      'Elena came home from a two-week trip.',
      'Her tomato plants were brown and drooping.',
      'The watering can sat exactly where she had left it.',
      'Her son said he had been very busy with work.',
    ],
    question: 'Why did the plants wilt?',
    options: [
      'Nobody watered them',
      'They had a plant disease',
      'There was too much rain',
      'The soil was bad',
    ],
    correctIndex: 0,
    explanation: 'The untouched watering can and the busy son show the plants were never watered.',
    questionType: 'cause_effect',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-exp-06',
    title: 'The Borrowed Ladder',
    tier: 2,
    story: [
      'Marcus knocked on his neighbor\'s door holding his ladder.',
      'There were leaves and small branches all over the yards.',
      'The neighbor\'s gutter was overflowing when it rained last night.',
      'The neighbor smiled and got his work gloves.',
    ],
    question: 'What are the two men probably going to do?',
    options: [
      'Clean the gutters together',
      'Paint the house',
      'Trim the hedges',
      'Fix the roof antenna',
    ],
    correctIndex: 0,
    explanation: 'A ladder, an overflowing gutter, and work gloves point to cleaning the gutters.',
    questionType: 'inference',
    hintSentenceIndex: 2,
  },
  {
    id: 'case-exp-07',
    title: 'The Early Bus',
    tier: 3,
    story: [
      'Every day, Willa caught the 8:15 bus to the clinic.',
      'This morning her clock still said 7:20 when the bus rolled past her window.',
      'She checked her phone: it said 8:20.',
      'The power had flickered during the storm last night.',
      'Willa sighed and put on her coat anyway.',
    ],
    question: 'Why did Willa miss the bus?',
    options: [
      'The storm reset her clock to the wrong time',
      'The bus came earlier than scheduled',
      'She overslept through her alarm',
      'The clinic changed her appointment',
    ],
    correctIndex: 0,
    explanation: 'The power flicker stopped her clock overnight, so it showed 7:20 when it was really 8:20.',
    questionType: 'inference',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-exp-08',
    title: 'The Two Umbrellas',
    tier: 3,
    story: [
      'Ray checked the gray sky and grabbed his umbrella.',
      'At the door, he paused and went back for a second one.',
      'His daughter had walked to the library an hour ago.',
      'The first drops were starting to fall.',
      'He headed toward the library instead of his office.',
    ],
    question: 'What will Ray most likely do next?',
    options: [
      'Bring the extra umbrella to his daughter',
      'Sell one of the umbrellas',
      'Return a library book',
      'Wait out the rain at home',
    ],
    correctIndex: 0,
    explanation: 'Two umbrellas, a daughter who walked without one, rain starting, and walking her way — he\'s bringing it to her.',
    questionType: 'prediction',
    hintSentenceIndex: 1,
  },
  {
    id: 'case-exp-09',
    title: 'Cold Feet',
    tier: 3,
    story: [
      'Before the wedding toast, Uncle Joe kept folding and unfolding a small paper.',
      'He tapped his glass twice, then put his spoon down.',
      'He took a long drink of water.',
      'His niece squeezed his arm and whispered something.',
      'Joe stood up, smiled, and unfolded the paper one more time.',
    ],
    question: 'The title "Cold Feet" mostly describes what?',
    options: [
      'Joe being nervous about his speech',
      'The room being too cold',
      'Joe\'s shoes being wet',
      'The food getting cold',
    ],
    correctIndex: 0,
    explanation: '"Cold feet" is a saying for nervousness — the fidgeting, water, and encouragement show Joe\'s nerves.',
    questionType: 'figurative',
    hintSentenceIndex: 0,
  },
  {
    id: 'case-exp-10',
    title: 'The Spare Key',
    tier: 3,
    story: [
      'Dee stood on her porch patting her coat pockets.',
      'Her purse was visible on the kitchen table through the window.',
      'She lifted the flowerpot by the door and frowned.',
      'Her brother had borrowed the spare key last month.',
      'She took out her phone and scrolled to his name.',
    ],
    question: 'What will Dee most likely do next?',
    options: [
      'Call her brother about the spare key',
      'Break the window to get in',
      'Water the flowerpot',
      'Go buy a new purse',
    ],
    correctIndex: 0,
    explanation: 'Locked out, spare key gone, brother has it, phone open to his name — she\'s calling him.',
    questionType: 'prediction',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-exp-11',
    title: 'Reading the Room',
    tier: 3,
    story: [
      'Priya walked into the break room mid-sentence into her joke.',
      'Nobody looked up from the table.',
      'Her manager was speaking in a low, slow voice.',
      'A box of tissues sat in the middle of the table.',
      'Priya quietly slid into a chair and let the joke go.',
    ],
    question: 'Why did Priya stop telling her joke?',
    options: [
      'She sensed the room was upset about something serious',
      'She forgot the ending',
      'Her manager told her to be quiet',
      'The break was over',
    ],
    correctIndex: 0,
    explanation: 'Quiet voices, no smiles, and tissues signal bad news — Priya read the mood and held back.',
    questionType: 'inference',
    hintSentenceIndex: 3,
  },
  {
    id: 'case-exp-12',
    title: 'The Long Way Home',
    tier: 3,
    story: [
      'Ben\'s doctor told him walking would help his heart.',
      'That evening, Ben got off the bus two stops early.',
      'The next week, he got off three stops early.',
      'By spring, he was skipping the bus entirely on sunny days.',
      'His neighbor joked that she never saw his car anymore.',
    ],
    question: 'What does the story suggest about Ben?',
    options: [
      'He slowly built walking into his daily life',
      'He could no longer afford the bus',
      'His car broke down in the spring',
      'He moved closer to his job',
    ],
    correctIndex: 0,
    explanation: 'Two stops, then three, then none — Ben gradually made walking a habit, as his doctor advised.',
    questionType: 'inference',
    hintSentenceIndex: 0,
  },
];

/**
 * Get cases filtered by difficulty tier
 */
export const getCasesByTier = (tier: 1 | 2 | 3): DetectiveCase[] => {
  return DETECTIVE_CASES.filter(c => c.tier === tier);
};

// ─── Phase 1.5 Adaptive Standard ───────────────────────────────────────────
// Strict 3-tier mapping for comprehension + reasoning exercise.
// Engine level (1-10) → tier (1|2|3). No ±tolerance, no blending.
// Aligned to the canonical Phase 1.5 split (≤3 / 4-7 / ≥8) used by
// PhotoNaming and MultiStepPlanning so all games share one engine contract.

export type DetectiveTier = 1 | 2 | 3;

export const mapEngineLevelToDetectiveTier = (level: number): DetectiveTier => {
  if (level <= 3) return 1;
  if (level <= 7) return 2;
  return 3;
};

/**
 * Legacy alias — kept for backward compatibility with existing imports.
 * @deprecated use mapEngineLevelToDetectiveTier
 */
export const levelToTier = mapEngineLevelToDetectiveTier;

/**
 * Strict tier-isolated selector (Phase 1.5 contract).
 * Returns ONLY cases at the tier corresponding to the engine level.
 * Never blends across tiers; if the pool is exhausted by exclusions,
 * repeats are allowed within the same tier.
 */
export function getDetectiveCasesForLevel(
  level: number,
  count: number,
  excludeIds: string[] = []
): DetectiveCase[] {
  const targetTier = mapEngineLevelToDetectiveTier(level);
  const excludeSet = new Set(excludeIds);
  let pool = DETECTIVE_CASES.filter(
    c => c.tier === targetTier && !excludeSet.has(c.id)
  );
  if (pool.length === 0) {
    pool = DETECTIVE_CASES.filter(c => c.tier === targetTier);
  }
  const order = pool.map(p => [Math.random(), p] as const).sort((a, b) => a[0] - b[0]);
  return order.slice(0, Math.min(count, order.length)).map(([, p]) => p);
}

/**
 * Per-case difficulty signal — used by the audit harness to confirm
 * an L1 → L10 perceptual curve actually exists for comprehension/reasoning.
 *   • story_length: number of sentences (working-memory load)
 *   • options_count: number of choices (decision load)
 *   • inference_depth: 0 literal, 1 cause/effect, 2 inference, 3 prediction/figurative
 */
const QUESTION_INFERENCE_DEPTH: Record<QuestionType, number> = {
  literal: 0,
  cause_effect: 1,
  inference: 2,
  prediction: 3,
  figurative: 3,
};

export function computeDetectiveDifficulty(c: DetectiveCase): {
  story_length: number;
  options_count: number;
  inference_depth: number;
  composite: number;
} {
  const story_length = c.story.length;
  const options_count = c.options.length;
  const inference_depth = QUESTION_INFERENCE_DEPTH[c.questionType] ?? 0;
  // Normalize roughly to 0-1 and weight inference heaviest.
  const composite =
    (story_length / 8) * 0.25 +
    (options_count / 5) * 0.15 +
    (inference_depth / 3) * 0.6;
  return { story_length, options_count, inference_depth, composite };
}
