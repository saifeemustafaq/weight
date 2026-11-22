# Morning weight

A public page for a household to log a morning weight. There are no accounts. Each save records the weight and the time, and the graph fills in from those mornings. MongoDB Atlas holds the data.

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

Open http://localhost:3001 (or whichever port `npm run dev` prints). The board starts with four placeholder names. Rename them, add or remove people, and fix any weigh-in at `/admin`.

Weights show in kg until someone taps lb. The switch at the top changes how weights are shown and typed. Everything is stored in pounds, so switching never changes saved data. Each phone remembers its own choice.

Logging again on the same morning updates that entry. Undo removes today only.

`/admin` has no password, so anyone with the address can use it. It lists every person with their weigh-ins. There you can rename or remove a person (their weigh-ins go with them), add a weigh-in for any past day, edit or delete one, and clear one person's weigh-ins or everyone's.
