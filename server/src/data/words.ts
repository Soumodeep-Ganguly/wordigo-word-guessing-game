import { Difficulty } from "../types/game";

export interface WordEntry {
  word: string;
  category: string;
  difficulty: Difficulty;
  hint: string;
  hint2?: string;
}

/**
 * Structured word database.
 * To expand: append entries following the WordEntry shape — the game
 * automatically picks them up for system-generated rounds and offline play.
 */
export const WORD_DATABASE: WordEntry[] = [
  // ─── Animals ────────────────────────────────────────────────
  { word: "DOLPHIN", category: "Animals", difficulty: "Easy", hint: "A highly intelligent sea animal" },
  { word: "ELEPHANT", category: "Animals", difficulty: "Easy", hint: "The largest land animal", hint2: "It has a long trunk" },
  { word: "PENGUIN", category: "Animals", difficulty: "Easy", hint: "A bird that swims but cannot fly" },
  { word: "GIRAFFE", category: "Animals", difficulty: "Easy", hint: "Known for its very long neck" },
  { word: "KANGAROO", category: "Animals", difficulty: "Easy", hint: "Australian animal that hops and carries its young in a pouch" },
  { word: "CHEETAH", category: "Animals", difficulty: "Medium", hint: "The fastest land animal" },
  { word: "OCTOPUS", category: "Animals", difficulty: "Medium", hint: "Sea creature with eight arms and three hearts" },
  { word: "CHAMELEON", category: "Animals", difficulty: "Medium", hint: "A lizard famous for changing color" },
  { word: "HEDGEHOG", category: "Animals", difficulty: "Medium", hint: "A small spiny mammal that curls into a ball" },
  { word: "PLATYPUS", category: "Animals", difficulty: "Hard", hint: "An egg-laying mammal with a duck bill" },
  { word: "PORCUPINE", category: "Animals", difficulty: "Medium", hint: "A rodent covered in sharp quills" },
  { word: "FLAMINGO", category: "Animals", difficulty: "Easy", hint: "A pink bird that stands on one leg" },
  { word: "SLOTH", category: "Animals", difficulty: "Medium", hint: "One of the slowest mammals, hangs in trees" },
  { word: "WALRUS", category: "Animals", difficulty: "Medium", hint: "A large Arctic mammal with tusks" },
  { word: "AXOLOTL", category: "Animals", difficulty: "Hard", hint: "A salamander that stays aquatic its whole life" },

  // ─── Food ───────────────────────────────────────────────────
  { word: "PIZZA", category: "Food", difficulty: "Easy", hint: "Italian dish with cheese and toppings on flat dough" },
  { word: "SUSHI", category: "Food", difficulty: "Easy", hint: "Japanese dish with rice and raw fish" },
  { word: "PANCAKE", category: "Food", difficulty: "Easy", hint: "Flat breakfast cake often eaten with syrup" },
  { word: "SPAGHETTI", category: "Food", difficulty: "Easy", hint: "Long thin Italian pasta" },
  { word: "DUMPLING", category: "Food", difficulty: "Medium", hint: "Dough wrapped around a filling, common in Asian cuisine" },
  { word: "GUACAMOLE", category: "Food", difficulty: "Medium", hint: "A creamy Mexican dip made from avocados" },
  { word: "CROISSANT", category: "Food", difficulty: "Medium", hint: "A flaky, buttery French pastry" },
  { word: "MOZZARELLA", category: "Food", difficulty: "Medium", hint: "A soft Italian cheese used on pizza" },
  { word: "BROWNIE", category: "Food", difficulty: "Easy", hint: "A dense chocolate dessert square" },
  { word: "LASAGNA", category: "Food", difficulty: "Easy", hint: "Layered Italian pasta bake" },
  { word: "HUMMUS", category: "Food", difficulty: "Medium", hint: "A Middle Eastern dip made from chickpeas" },
  { word: "PRETZEL", category: "Food", difficulty: "Easy", hint: "A knotted, salted baked snack" },
  { word: "RISOTTO", category: "Food", difficulty: "Hard", hint: "Creamy Italian rice dish cooked slowly with broth" },
  { word: "TIRAMISU", category: "Food", difficulty: "Hard", hint: "Coffee-flavored Italian dessert with mascarpone" },

  // ─── Movies ─────────────────────────────────────────────────
  { word: "TITANIC", category: "Movies", difficulty: "Easy", hint: "A 1997 romance on a doomed ship" },
  { word: "FROZEN", category: "Movies", difficulty: "Easy", hint: "Disney film about two royal sisters and an ice queen" },
  { word: "AVATAR", category: "Movies", difficulty: "Easy", hint: "Blue aliens on the moon Pandora" },
  { word: "GLADIATOR", category: "Movies", difficulty: "Medium", hint: "A Roman general seeks revenge in the arena" },
  { word: "INCEPTION", category: "Movies", difficulty: "Medium", hint: "Thieves steal secrets from dreams" },
  { word: "JURASSIC", category: "Movies", difficulty: "Medium", hint: "Dinosaurs brought back to life in a park" },
  { word: "CASABLANCA", category: "Movies", difficulty: "Hard", hint: "Classic 1942 romance set in Morocco" },
  { word: "GOODFELLAS", category: "Movies", difficulty: "Hard", hint: "Scorsese's mob masterpiece" },
  { word: "SHREK", category: "Movies", difficulty: "Easy", hint: "A grumpy green ogre on a quest" },
  { word: "MATRIX", category: "Movies", difficulty: "Medium", hint: "Reality is a computer simulation" },
  { word: "GODFATHER", category: "Movies", difficulty: "Medium", hint: "An iconic mafia family saga" },
  { word: "SPIDERMAN", category: "Movies", difficulty: "Easy", hint: "A web-slinging teenage superhero" },
  { word: "INTERSTELLAR", category: "Movies", difficulty: "Hard", hint: "Astronauts search for a new home through a wormhole" },
  { word: "PARASITE", category: "Movies", difficulty: "Hard", hint: "Korean thriller about class conflict, Oscar winner" },

  // ─── Sports ─────────────────────────────────────────────────
  { word: "SOCCER", category: "Sports", difficulty: "Easy", hint: "The world's most popular sport, played with a round ball" },
  { word: "TENNIS", category: "Sports", difficulty: "Easy", hint: "Played with rackets on a court with a net" },
  { word: "BASKETBALL", category: "Sports", difficulty: "Easy", hint: "Five players per team shoot hoops" },
  { word: "MARATHON", category: "Sports", difficulty: "Medium", hint: "A 42.2 kilometer race" },
  { word: "SURFING", category: "Sports", difficulty: "Easy", hint: "Riding waves on a board" },
  { word: "BOXING", category: "Sports", difficulty: "Easy", hint: "Two fighters compete wearing gloves" },
  { word: "ARCHERY", category: "Sports", difficulty: "Medium", hint: "Hitting targets with a bow and arrows" },
  { word: "GYMNASTICS", category: "Sports", difficulty: "Medium", hint: "Athletes perform flips on beams and bars" },
  { word: "FENCING", category: "Sports", difficulty: "Medium", hint: "Sword fighting as an Olympic sport" },
  { word: "CURLING", category: "Sports", difficulty: "Hard", hint: "Ice sport with stones swept toward a house" },
  { word: "TRIATHLON", category: "Sports", difficulty: "Hard", hint: "Swim, bike, run — in one race" },
  { word: "SKATEBOARDING", category: "Sports", difficulty: "Medium", hint: "Olympic sport performed on four wheels" },

  // ─── Countries ──────────────────────────────────────────────
  { word: "JAPAN", category: "Countries", difficulty: "Easy", hint: "Island nation famous for sushi and bullet trains" },
  { word: "BRAZIL", category: "Countries", difficulty: "Easy", hint: "Largest country in South America, famous for carnival" },
  { word: "CANADA", category: "Countries", difficulty: "Easy", hint: "Maple syrup and hockey" },
  { word: "EGYPT", category: "Countries", difficulty: "Easy", hint: "Home of the pyramids and the Nile" },
  { word: "PORTUGAL", category: "Countries", difficulty: "Medium", hint: "Iberian nation famous for port wine and fado" },
  { word: "MOROCCO", category: "Countries", difficulty: "Medium", hint: "North African country with Marrakech medinas" },
  { word: "ICELAND", category: "Countries", difficulty: "Medium", hint: "Land of fire and ice, geysers and glaciers" },
  { word: "ARGENTINA", category: "Countries", difficulty: "Medium", hint: "Birthplace of tango and Messi" },
  { word: "THAILAND", category: "Countries", difficulty: "Medium", hint: "Southeast Asian country, capital Bangkok" },
  { word: "KAZAKHSTAN", category: "Countries", difficulty: "Hard", hint: "Largest landlocked country in the world" },
  { word: "PERU", category: "Countries", difficulty: "Easy", hint: "Home of Machu Picchu" },
  { word: "GREECE", category: "Countries", difficulty: "Easy", hint: "Ancient homeland of the Olympics and democracy" },
  { word: "VIETNAM", category: "Countries", difficulty: "Medium", hint: "Pho and lantern-lit Hoi An" },
  { word: "MADAGASCAR", category: "Countries", difficulty: "Hard", hint: "Island nation where most lemurs live" },

  // ─── Technology ─────────────────────────────────────────────
  { word: "KEYBOARD", category: "Technology", difficulty: "Easy", hint: "You type on it every day" },
  { word: "INTERNET", category: "Technology", difficulty: "Easy", hint: "The global network connecting billions of devices" },
  { word: "ROBOT", category: "Technology", difficulty: "Easy", hint: "A machine that can carry out complex actions automatically" },
  { word: "BLUETOOTH", category: "Technology", difficulty: "Medium", hint: "Short-range wireless tech named after a Viking king" },
  { word: "FIREWALL", category: "Technology", difficulty: "Medium", hint: "A network security barrier" },
  { word: "ALGORITHM", category: "Technology", difficulty: "Medium", hint: "A step-by-step procedure for calculations" },
  { word: "SOFTWARE", category: "Technology", difficulty: "Easy", hint: "The programs that run on a computer" },
  { word: "SATELLITE", category: "Technology", difficulty: "Medium", hint: "An object orbiting Earth relaying signals" },
  { word: "CRYPTOGRAPHY", category: "Technology", difficulty: "Hard", hint: "The science of secure communication" },
  { word: "BLOCKCHAIN", category: "Technology", difficulty: "Hard", hint: "A distributed, tamper-resistant digital ledger" },
  { word: "PROCESSOR", category: "Technology", difficulty: "Medium", hint: "The chip that acts as a computer's brain" },
  { word: "PIXEL", category: "Technology", difficulty: "Easy", hint: "The smallest unit of a digital image" },
  { word: "BROWSER", category: "Technology", difficulty: "Easy", hint: "The app you use to visit websites" },
  { word: "QUANTUM", category: "Technology", difficulty: "Hard", hint: "Computing that uses superposition and entanglement" },

  // ─── Nature ─────────────────────────────────────────────────
  { word: "VOLCANO", category: "Nature", difficulty: "Easy", hint: "A mountain that erupts lava" },
  { word: "RAINBOW", category: "Nature", difficulty: "Easy", hint: "Appears in the sky after rain, with seven colors" },
  { word: "GLACIER", category: "Nature", difficulty: "Medium", hint: "A huge, slow-moving river of ice" },
  { word: "DESERT", category: "Nature", difficulty: "Easy", hint: "The Sahara is the largest hot one" },
  { word: "WATERFALL", category: "Nature", difficulty: "Easy", hint: "A river falling from a height, like Niagara" },
  { word: "THUNDER", category: "Nature", difficulty: "Easy", hint: "The sound that follows lightning" },
  { word: "HURRICANE", category: "Nature", difficulty: "Medium", hint: "A massive rotating tropical storm" },
  { word: "CORAL", category: "Nature", difficulty: "Medium", hint: "Sea structures that build reefs" },
  { word: "GEYSER", category: "Nature", difficulty: "Hard", hint: "A hot spring that shoots water into the air" },
  { word: "SAVANNA", category: "Nature", difficulty: "Medium", hint: "Tropical grassland dotted with acacia trees" },
  { word: "MONSOON", category: "Nature", difficulty: "Hard", hint: "Seasonal winds that bring heavy rain" },
  { word: "CANYON", category: "Nature", difficulty: "Easy", hint: "A deep gorge carved by a river, like the Grand one" },
  { word: "AURORA", category: "Nature", difficulty: "Medium", hint: "Northern lights dancing in polar skies" },
  { word: "MEADOW", category: "Nature", difficulty: "Easy", hint: "An open field of wildflowers and grass" },

  // ─── General ────────────────────────────────────────────────
  { word: "LIBRARY", category: "General", difficulty: "Easy", hint: "A quiet place full of books" },
  { word: "UMBRELLA", category: "General", difficulty: "Easy", hint: "Keeps the rain off your head" },
  { word: "TREASURE", category: "General", difficulty: "Easy", hint: "Pirates bury it and maps mark X" },
  { word: "PUZZLE", category: "General", difficulty: "Easy", hint: "A game that tests your mind, often a jigsaw" },
  { word: "ORCHESTRA", category: "General", difficulty: "Medium", hint: "A large group of musicians led by a conductor" },
  { word: "LABYRINTH", category: "General", difficulty: "Hard", hint: "A maze full of winding passages" },
  { word: "COMPASS", category: "General", difficulty: "Easy", hint: "Its needle always points north" },
  { word: "CARNIVAL", category: "General", difficulty: "Medium", hint: "A festival with parades, masks and rides" },
  { word: "MONOLOGY", category: "General", difficulty: "Hard", hint: "A long speech by one speaker" },
  { word: "INSTRUMENT", category: "General", difficulty: "Medium", hint: "A tool for making music" },
  { word: "DIAMOND", category: "General", difficulty: "Easy", hint: "The hardest gemstone" },
  { word: "MAGNET", category: "General", difficulty: "Easy", hint: "It attracts iron" },
  { word: "TELESCOPE", category: "General", difficulty: "Medium", hint: "Galileo used one to study the stars" },
  { word: "FESTIVAL", category: "General", difficulty: "Easy", hint: "A big organized celebration, often with music" },
];

export const CATEGORIES = [
  "Animals",
  "Food",
  "Movies",
  "Sports",
  "Countries",
  "Technology",
  "Nature",
  "General",
] as const;

export const DIFFICULTIES: Difficulty[] = ["Easy", "Medium", "Hard"];

export function getWordsByDifficulty(difficulty: Difficulty): WordEntry[] {
  return WORD_DATABASE.filter((w) => w.difficulty === difficulty);
}

export function getWordByCategoryAndDifficulty(
  category: string | undefined,
  difficulty: Difficulty
): WordEntry[] {
  return WORD_DATABASE.filter(
    (w) =>
      (!category || w.category === category) && w.difficulty === difficulty
  );
}

export function pickRandomWord(
  opts: { difficulty?: Difficulty; category?: string; exclude?: Set<string> } = {}
): WordEntry {
  let pool = WORD_DATABASE.filter(
    (w) => (!opts.difficulty || w.difficulty === opts.difficulty) &&
      (!opts.category || w.category === opts.category)
  );
  const fresh = pool.filter((w) => !opts.exclude?.has(w.word));
  if (fresh.length > 0) pool = fresh;
  if (pool.length === 0) pool = WORD_DATABASE;
  return pool[Math.floor(Math.random() * pool.length)];
}
