const fetch = require('node-fetch'); // Let's just use native fetch if Node 18+

async function run() {
  const text = `The Ooty trip with parents, we did leave at 5am on October 2nd as planned. We headed towards Gundlupet where we were supposed to have breakfast but we reached there around 6:15am and restaurants wouldn’t open till 7am. So we had to move on. 
We moved towards Bandipur Forest where we enjoyed slow drive and watching a lot of monkeys, peacocks, wild pigs, deers, and even a few elephants. Sadly no luck with Tiger. 
After the forest we had breakfast in a random restaurant we found cause mom wanted to use washroom. It was garbage breakfast, we had 2 plates of set dosas but the chutney had way too many fat mustards.
We then headed towards Needle rock view point where we took a bunch of photos and mom was happy and smiling so much that it made my heart so warm.
We then headed towards Karnataka Park, where the garden scaping was done incredibly. The flowers were beautiful, the walk was peaceful, sleeping on the grass was very fun too. It was an incredible 2 hours of experience. We took a lot of photos here too, more like I took moms photos a lot and a few of dads photos too. 
Then we headed to the Sterling Ooty Fern Hill resort where I had booked the stay, had to pay additional for extra bed since each room allows only 2 people. Did that. It was around 2:30 pm now and resort has À la carte restaurant where we had honey chilli potato, hara Bara paneer, masala papad, veg biryani and they were all awesome. 
Then we rested for a few hours in the room. Around 6pm we woke up, more like parents woke up and I couldn’t sleep cause dad snores a crap lot and loud. And after that we got ready and we headed towards bon fire and music because apparently it was the days special event. Stayed there for over an hour and then went for buffet dinner. This was just top notch food. All kinds of Indian breads, 4-5 different veg curries, 6-7 different desserts, multiple rice items etc etc. even a chat centre with pani puri, dahi puri, sev puri, papdi chaat and all. It was incredible. Had food.
Then came back to room, and parents stomach gave up by then, they ended up in washroom one after another. And then we slept. Well more like they slept, and I couldn’t cause dad snores.`;

  // We can't hit the API directly without auth easily, because the API requires a Supabase user token.
  // We can simulate it by directly calling the agentic extraction function.
}

run();
