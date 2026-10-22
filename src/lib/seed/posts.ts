// Starter blog posts (seeded once; edit or unpublish them from Admin → Blog & SEO).
// Written to Google's people-first guidance: real kitchen experience, cited sources
// for nutrition facts, clear structure and internal links.
import type { Post } from "../types";

type SeedPost = Omit<Post, "id" | "createdAt" | "updatedAt" | "publishedAt" | "coverImage" | "ogImage"> & { coverDish: string; daysAgo: number };

const AUTHOR = "Leafli Kitchen Team";
const BIO = "The chefs behind Leafli's bowls. We write every recipe down, weigh every portion and test what travels well — this blog shares what we've learned.";

export const SEED_POSTS: SeedPost[] = [
  {
    slug: "how-to-build-a-balanced-salad-bowl",
    title: "How to Build a Balanced Salad Bowl That Actually Keeps You Full",
    excerpt: "A salad can be a proper meal — if it has the right parts. Here's the simple six-part formula our kitchen uses to build a balanced salad bowl that keeps you full until dinner.",
    category: "Healthy eating",
    tags: ["salad", "balanced diet", "meal planning", "lunch ideas"],
    focusKeyword: "balanced salad bowl",
    secondaryKeywords: ["filling salad", "healthy lunch bowl", "salad formula"],
    metaTitle: "How to Build a Balanced Salad Bowl That Keeps You Full",
    metaDescription: "Our six-part formula for a balanced salad bowl: greens, protein, slow carbs, healthy fats, crunch and a great dressing. Simple, filling and easy to repeat.",
    coverAlt: "A balanced salad bowl with chickpeas, sprouts, mango, cucumber and tomato",
    coverDish: "chana-moong",
    relatedMenuIds: ["chana-moong", "chicken-caesar", "caprese"],
    daysAgo: 12,
    authorName: AUTHOR,
    authorBio: BIO,
    status: "published",
    content: `A lot of people give up on salads because an hour later they're hungry again. That isn't a salad problem — it's a building problem. A **balanced salad bowl** needs more than leaves. When we design a bowl at Leafli, we check it against the same six building blocks every time.

## The six parts of a balanced salad bowl

### 1. A generous base of vegetables
Leafy greens, crunchy vegetables and a little fruit give you fibre, vitamins and volume for very few calories. The World Health Organization recommends eating [at least 400 g of fruit and vegetables a day](https://www.who.int/news-room/fact-sheets/detail/healthy-diet) — a good salad can cover a big share of that in one meal.

**Tip:** mix textures. Crisp lettuce, juicy cherry tomatoes and shredded purple cabbage feel more satisfying than one kind of leaf.

### 2. A real portion of protein
Protein is what turns a side salad into lunch. It slows digestion and helps you stay full. Good options:

- Chickpeas, moong sprouts or other legumes
- Paneer, mozzarella or hung curd
- Eggs
- Grilled chicken

Our [Desi Mango & Sprout Salad](/menu/desi-mango-sprout-salad) uses both chana and moong, while the [Classic Chicken Caesar](/menu/classic-chicken-caesar-salad) pairs grilled chicken with eggs.

### 3. Some slow-release carbohydrates
A small portion of grains, noodles, potatoes or legumes gives you steady energy for the afternoon. Think roasted potatoes, rice noodles or extra chana — enough to fuel you, not so much that you get sleepy.

### 4. Healthy fats
Fat carries flavour and helps your body absorb fat-soluble vitamins from the vegetables. Nuts, seeds, a cold-pressed oil dressing, avocado or cheese all count. A little goes a long way — we weigh ours to the gram.

### 5. Something crunchy
Crunch makes a bowl satisfying to eat. Toasted seeds, peanuts, walnuts, croutons or granola all work. Add them at the last minute so they stay crisp — which is why our crunchy toppings travel separately.

### 6. A dressing with personality
A good dressing ties everything together. Bright acidity (lemon, vinegar), something savoury, and a touch of sweetness or heat. Keep it on the side until you're ready to eat so your greens don't wilt.

## A balanced salad bowl, by the numbers

There's no single perfect ratio, but this is a useful starting point for one bowl:

| Part | Roughly |
| --- | --- |
| Vegetables & greens | Half the bowl |
| Protein | A quarter of the bowl |
| Slow carbs | A small handful |
| Healthy fats & crunch | 1–2 tablespoons |
| Dressing | 2–3 tablespoons, on the side |

## Common mistakes that leave you hungry

- **Leaves only.** Without protein and some carbs, a salad won't last you till evening.
- **Drowning it in dressing.** Too much turns a fresh bowl heavy. Start with less; you can always add more.
- **Dressing it too early.** Pre-dressed salads go soggy fast. Toss just before eating.
- **No variety.** Rotating your bowls through the week keeps it interesting — and gives you a wider range of nutrients.

## Three balanced salad bowl ideas to try this week

**The desi protein bowl.** Chana and moong sprouts for protein, cucumber, tomato and onion for crunch, diced mango for sweetness, and a squeeze of lemon with chaat masala. Finish with a tangy mango-chilli dressing on the side. It's light, but the legumes keep you going all afternoon.

**The Mediterranean-style bowl.** A bed of rocket and lettuce, slices of tomato and fresh mozzarella, plenty of basil, a few toasted pine nuts and a basil-walnut pesto. The cheese brings protein and fat, so a modest portion is satisfying.

**The warm-and-cool bowl.** Roasted potatoes (cooled), crisp apple, lettuce, cherry tomatoes and walnuts, with a creamy, tangy egg-based dressing. The potatoes cover your slow carbs and the walnuts add healthy fats.

Each of these hits all six parts of a balanced salad bowl — vegetables, protein, slow carbs, healthy fats, crunch and dressing — in a different way, so you can rotate them without getting bored.

## Adjusting your bowl for different goals

- **More energy for workouts:** add an extra portion of slow carbs such as noodles, potatoes or legumes.
- **Feeling hungry by 4 pm:** increase the protein first, then the healthy fats.
- **Lighter dinner:** keep the vegetables generous and go easy on carbs and dressing.
- **Managing a health condition:** portions matter more than rules — check with a doctor or registered dietitian.

## Building a balanced salad bowl on a budget

Eating well doesn't need imported ingredients. Some of the best-value building blocks are already in an Indian kitchen:

- **Seasonal vegetables** — cabbage, carrot, cucumber, tomato and onion are cheap, crunchy and last well.
- **Dried legumes** — a kilo of dried chana or moong makes many portions of protein once soaked and cooked.
- **Peanuts and sesame** — affordable crunch and healthy fats; toast them for more flavour.
- **Homemade dressings** — lemon, curd, mint, cumin and a little oil cost a fraction of bottled dressings.
- **Seasonal fruit** — mango in summer, oranges and guava in winter add sweetness for very little.

Buy whole vegetables rather than pre-cut, cook legumes in batches, and plan bowls around what's in season.

## Make it easy to stick with

The hardest part of eating well is doing it every day. If you'd rather not plan and chop, a [salad subscription](/plans) delivers a balanced bowl on the days you choose, with dressings packed separately so it arrives crisp.

Start with a few bowls a week, notice how you feel in the afternoons, and build from there.`,
    faqs: [
      { q: "Can a salad be a complete meal?", a: "Yes, if it includes vegetables, a real portion of protein, some slow-release carbohydrates, healthy fats and a dressing. Leaves alone won't keep you full." },
      { q: "How much protein should a salad have?", a: "Aim for a palm-sized portion of protein — legumes, paneer, eggs, chicken or cheese — so the bowl keeps you satisfied for several hours." },
      { q: "Why should dressing be kept separate?", a: "Dressing makes leaves wilt and crunchy toppings go soft. Adding it just before eating keeps the salad crisp." },
    ],
  },
  {
    slug: "high-protein-vegetarian-salad-ideas",
    title: "High-Protein Vegetarian Salads: 7 Easy Ways to Hit Your Protein Goals",
    excerpt: "Vegetarian and still short on protein? These seven high-protein salad ingredients — from chana and sprouts to paneer and hung curd — make it easy to get more protein into every bowl.",
    category: "Nutrition",
    tags: ["protein", "vegetarian", "high protein", "salad"],
    focusKeyword: "high protein vegetarian salad",
    secondaryKeywords: ["vegetarian protein sources", "protein salad India", "high protein lunch"],
    metaTitle: "High Protein Vegetarian Salad: 7 Easy Protein Boosters",
    metaDescription: "Build a high protein vegetarian salad with chana, sprouts, paneer, hung curd, nuts and more. How much protein you need and simple ways to add it to every bowl.",
    coverAlt: "Salad Caprese with buffalo mozzarella, tomatoes, basil and pine nuts",
    coverDish: "caprese",
    relatedMenuIds: ["caprese", "chana-moong", "asian-rice-noodle"],
    daysAgo: 6,
    authorName: AUTHOR,
    authorBio: BIO,
    status: "published",
    content: `Many vegetarians in India fall short on protein without realising it — not because vegetarian food lacks protein, but because our everyday meals lean heavily on grains. A **high protein vegetarian salad** is one of the easiest ways to close the gap at lunch.

## How much protein do you actually need?

The Indian Council of Medical Research – National Institute of Nutrition (ICMR-NIN) puts the requirement for healthy adults at about 0.83 g of protein per kilogram of body weight per day ([ICMR-NIN, Nutrient Requirements for Indians, 2020](https://www.nin.res.in/)). For someone who weighs 65 kg, that's roughly 54 g a day. People who train regularly often aim higher — speak to a dietitian if you have specific goals.

Some people need more: regular gym-goers, older adults trying to preserve muscle, and anyone recovering from illness often benefit from a higher intake, while people with kidney conditions may need less — so it's worth getting personal advice.

Spread across three meals, that means each meal should carry a real portion of protein. Here's how to do it in a salad.

## 7 protein boosters for a high protein vegetarian salad

### 1. Chana (chickpeas)
Cooked chickpeas bring around 8–9 g of protein per 100 g plus plenty of fibre. They hold their shape well, which makes them perfect for salads. Ours go into the [Desi Mango & Sprout Salad](/menu/desi-mango-sprout-salad).

### 2. Moong and other sprouts
Sprouted moong adds a fresh crunch and extra protein. Combining legumes like chana and moong also gives you a better mix of amino acids.

### 3. Paneer
Paneer is one of the richest vegetarian protein sources, at roughly 18 g per 100 g. Grill or toss it in a light marinade so it doesn't feel heavy.

### 4. Mozzarella and other cheeses
Fresh mozzarella brings protein and creaminess. Our [Salad Caprese](/menu/salad-caprese) pairs buffalo mozzarella with tomatoes, basil and pine nuts.

### 5. Hung curd and Greek-style yoghurt
Strained yoghurt is higher in protein than regular curd and makes a brilliant creamy dressing base — try it with garlic, herbs and lemon.

### 6. Peanuts, nuts and seeds
A spoonful of peanuts, walnuts, pumpkin seeds or sesame adds protein, healthy fats and crunch. Peanuts are especially good value; our [Asian Noodle Salad](/menu/asian-noodle-salad) is finished with them.

### 7. Eggs (if you eat them)
For eggetarians, two eggs add around 12 g of high-quality protein. Hard-boil a batch at the start of the week.

## Putting it together: a sample bowl

- Base: lettuce, cucumber, tomato and shredded cabbage
- Protein: 100 g chana + a handful of moong sprouts
- Extra protein: 50 g grilled paneer
- Crunch: 1 tablespoon roasted peanuts
- Dressing: hung curd with lemon, mint and roasted cumin, on the side

That one bowl comfortably delivers a meaningful share of your daily protein, with fibre and very little effort. Swap paneer for tofu if you prefer a lighter option, or add a boiled egg if you eat eggs.

## Protein in common salad ingredients

Approximate protein per 100 g (values vary by brand and preparation — check the label where you can):

| Ingredient | Protein (approx.) |
| --- | --- |
| Peanuts, roasted | 25 g |
| Mozzarella | 20 g |
| Paneer | 18 g |
| Eggs (about 2) | 12 g |
| Hung curd / Greek-style yoghurt | 9–10 g |
| Chickpeas (chana), cooked | 8–9 g |
| Moong, cooked | 7 g |

The easiest way to build a high protein vegetarian salad is to combine two sources — for example chana with paneer, or sprouts with a yoghurt dressing and peanuts.

## Common mistakes that keep protein low

- **Treating protein as a garnish.** A few cubes of paneer won't move the needle; aim for a palm-sized portion.
- **Relying on one source.** Mixing legumes, dairy and nuts gives you a better amino-acid profile and more variety.
- **Skipping breakfast protein, then over-correcting at dinner.** Spreading protein across the day is easier on digestion and helps you stay full.
- **Choosing creamy dressings made mostly of oil.** A yoghurt-based dressing adds protein instead of only fat.

## A week of high protein vegetarian salad lunches

Need a plan? Here's a simple rotation that changes the protein every day:

1. **Monday:** chana and moong sprout salad with a curd-mint dressing.
2. **Tuesday:** grilled paneer, cucumber, tomato and onion with lemon and chaat masala.
3. **Wednesday:** mozzarella, tomato and basil over rocket with pesto and pine nuts.
4. **Thursday:** rice noodles, shredded vegetables and peanuts in a sesame-soy dressing, topped with tofu or extra peanuts.
5. **Friday:** roasted potatoes, apple and walnuts with boiled eggs or extra paneer.

Prep chana, paneer and dressings on Sunday and Wednesday, and each lunch takes about five minutes to assemble.

## Tips for making it a habit

- **Batch-cook your legumes.** Cook chana once, cool it quickly and refrigerate; it's ready for salads for the next couple of days.
- **Rotate your proteins.** Different sources bring different nutrients and keep your lunches interesting.
- **Don't forget the dressing.** A protein-rich yoghurt dressing is an easy win.

If you'd rather leave the cooking to us, our [Protein Pro subscription](/plans/protein-pro) rotates our most protein-rich bowls on the days you choose.`,
    faqs: [
      { q: "Can vegetarians get enough protein from salads?", a: "Yes. Adding legumes like chana and moong, paneer, cheese, hung curd and nuts can give a single salad bowl a substantial amount of protein." },
      { q: "Which vegetarian food has the most protein?", a: "Paneer, cheese, soya, peanuts and legumes like chickpeas and lentils are among the richest everyday vegetarian protein sources in Indian kitchens." },
      { q: "How much protein do adults need per day?", a: "ICMR-NIN recommends about 0.83 g of protein per kg of body weight per day for healthy adults; active people may need more." },
    ],
  },
  {
    slug: "how-to-keep-salad-fresh-and-crisp",
    title: "Why We Pack Dressing on the Side — and How to Keep Salad Fresh and Crisp",
    excerpt: "Soggy salad is a solved problem. Here's what our kitchen does to keep every bowl fresh and crisp from prep to your desk, and how you can do the same at home.",
    category: "From our kitchen",
    tags: ["food storage", "kitchen tips", "salad", "meal prep"],
    focusKeyword: "keep salad fresh",
    secondaryKeywords: ["how to keep salad crisp", "salad meal prep", "store salad in fridge"],
    metaTitle: "How to Keep Salad Fresh and Crisp: Tips From Our Kitchen",
    metaDescription: "How to keep salad fresh and crisp: dry your greens, keep dressing separate, store it below 5°C and add crunchy toppings last. Tips from our salad kitchen.",
    coverAlt: "Classic Chicken Caesar Salad with croutons, eggs and crisp lettuce",
    coverDish: "chicken-caesar",
    relatedMenuIds: ["chicken-caesar", "potato-apple"],
    daysAgo: 2,
    authorName: AUTHOR,
    authorBio: BIO,
    status: "published",
    content: `The number one complaint about delivered salads is that they arrive limp. We designed our whole kitchen around fixing that. Here's how we **keep salad fresh** — and crisp — from our board to your desk — and how you can use the same tricks for meal prep at home.

## 1. Dry your greens completely

Water is the enemy of crisp leaves. After washing, we spin our lettuce dry and only then store it. Wet leaves bruise, wilt and spoil faster. At home, a salad spinner is the single best investment for salads — or pat leaves dry gently with a clean kitchen towel.

Dry greens also hold dressing better, so you need less of it. If you're washing a large batch, spread the leaves on a clean towel for a few minutes after spinning, then store them loosely packed — tightly stuffed containers bruise the leaves and trap moisture.

## 2. Keep the dressing separate until you eat

Dressings contain acid, salt and oil, all of which pull water out of leaves and soften them within minutes. That's why every Leafli dressing — Caesar, pesto, mango-chilli and our egg gribiche — travels in its own sealed cup. Toss it in just before you eat.

## 3. Add crunchy toppings last

Croutons, nuts, seeds and granola lose their crunch as soon as they touch anything moist. We pack them so they stay dry, and in our [Dark Chocolate Fruit Bowl](/menu/dark-chocolate-fruit-bowl) the granola goes on at the very last step.

## 4. Keep it cold — properly cold

Cold slows down both wilting and bacterial growth. Our prepared ingredients are held at 4°C or below and every batch is labelled with when it was made and when it must be used by. India's food safety regulator, FSSAI, recommends storing perishable food under refrigeration to keep it safe — see its [Eat Right India](https://eatrightindia.gov.in/) resources for more.

At home:

- Keep your fridge at 5°C or colder.
- Store cut vegetables in airtight containers lined with a paper towel to absorb moisture.
- Don't leave salads out at room temperature for long — especially ones with eggs, dairy or chicken.

## 5. Cut fruit and delicate vegetables close to serving

Apples brown, tomatoes leak and cucumbers release water once cut. We cut these as close to dispatch as we can. If you're meal-prepping, keep juicy ingredients in a separate container and combine on the day.

## 6. Layer smartly in jars and boxes

If you pack salads ahead:

1. Dressing at the bottom (or in a separate pot)
2. Hardy, wet ingredients next — chana, cucumber, tomatoes
3. Grains and proteins
4. Delicate greens on top
5. Crunchy toppings in a separate small container

## Meal prep: how to keep salad fresh all week

If you prep lunches on Sunday, a little planning keeps salad fresh until Friday:

- **Prep components, not finished salads.** Wash and dry greens, chop sturdy vegetables, cook legumes and make one or two dressings — then store each separately.
- **Cook proteins in small batches.** Cooked chickpeas, eggs and chicken are best eaten within two to three days, so prep twice a week rather than once.
- **Cut the delicate stuff fresh.** Apples, avocado and tomatoes taste much better cut on the day.
- **Assemble in the morning.** Putting a bowl together takes five minutes when the components are ready, and the salad will still be crisp at lunchtime.

## Choose the right container

The container matters more than most people think. Use rigid, airtight boxes so leaves aren't crushed and air can't dry them out. Glass or BPA-free plastic both work. Keep a small separate pot for dressing and another for crunchy toppings. A folded paper towel on top of the greens absorbs condensation and buys you an extra day of crispness. Our delivery bowls follow the same idea: a rigid base, a sealed lid, and dressings in leak-proof cups.

## Signs a salad has gone off

Throw a salad out if you notice slimy or dark, mushy leaves, a sour or fermented smell, liquid pooling at the bottom of the container, or mould anywhere. Salads with egg, dairy, cooked rice, noodles or chicken are higher-risk — if they've been left out of the fridge for more than a couple of hours, don't take the chance.

## How long does salad stay fresh?

As a rough guide in a cold fridge: washed and well-dried lettuce lasts two to three days; chopped cabbage and carrot around three days; cut fruit and tomatoes are best within a day. Dressings with egg or dairy should be used within a few days. When in doubt, throw it out — smell and appearance alone can't prove food is safe.

## The easy way

If you'd rather not think about how to keep salad fresh at all, our bowls are assembled to order and delivered with everything packed the right way. Try a single [Classic Chicken Caesar](/menu/classic-chicken-caesar-salad), or set up a [subscription](/plans) and get a crisp lunch on the days you choose.`,
    faqs: [
      { q: "How do you keep a salad from getting soggy?", a: "Dry the greens thoroughly, keep the dressing separate until you eat, add crunchy toppings last and store everything cold in airtight containers." },
      { q: "How long can you keep salad in the fridge?", a: "Well-dried lettuce lasts about 2–3 days and chopped cabbage or carrot about 3 days. Cut fruit and tomatoes are best within a day." },
      { q: "Should salad dressing be stored separately?", a: "Yes. Dressing softens leaves quickly, so store it separately and add it just before eating." },
    ],
  },
];
