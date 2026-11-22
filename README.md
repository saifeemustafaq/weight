# Morning weight

A public page for four people to log a morning weight. There are no accounts. Each save records the weight and the time, and the graph fills in from those mornings. MongoDB Atlas holds the data.

## Setup

1. In Atlas, create a database user and allow this computer's IP. A Vercel deploy needs `0.0.0.0/0`, because the server address changes.
2. Create `.env.local` in this folder:

```
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.example.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=weight
FAMILY_TIMEZONE=America/Los_Angeles
```

If the password contains `@`, `:`, or `/`, URL-encode it. `FAMILY_TIMEZONE` decides which calendar day a morning belongs to. The default is Pacific time.

3. Start the app:

```
npm run dev
```

Open http://localhost:3000. Replace the four placeholder names on the cards. The names save to Atlas when you leave the field.

Weights show in kg until someone taps lb. The switch at the top changes how weights are shown and typed. Everything is stored in pounds, so switching never changes saved data. Each phone remembers its own choice.

Logging again on the same morning updates that entry. Clear removes today only.
