This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Feature ideas

Ideas for making the site better, roughly in priority order within each group. Ones marked **(backend)** need a new or changed endpoint in [dots-and-circles](https://github.com/AVespaIsNotAMotorcycle/dots-and-circles)'s `server/`.

### Explaining the results

- **Charts comparing training runs.** Each run's `log.csv` already holds the data. Plot against images seen (or wall-clock time), not epochs: an epoch of the 21,532-word lexicon is about 14× an epoch of the old 1,989-word one. Run-to-run variance is unknown (about ±2 points on the 500 logged photos), so show that as a band or a note, so small gaps don't read as real differences.
- **What the models struggle with.** A gallery of real photo misses grouped by failure type, plus a letter confusion chart. The known types are:
    - tooth strokes (ᠠ dropped or read as ᠨ)
    - the dotted/undotted pairs ᡨ/ᡩ and ᡥ/ᡤ
    - short words
    - variation selectors that can't be seen in the image
    - images over 256 px tall that get squashed

  The error marks in the prediction cards make each example readable.
- **Preprocessing walkthrough.** Show each step a photo goes through: plain → whitened → cropped → split into 4-row tokens. Preprocessing has a big effect (run 25: 0.2% → 16.4% exact on photos), and visitors don't see it today.
- **Synthetic vs real.** A clean render, a few augmented versions and a real photo of the same word, side by side. This shows why print augmentation took photo accuracy from 16% (run 25) to 47% (run 26).
- **"Built from scratch" page.** The network is numpy only, with every backward pass written by hand. A short page with the architecture diagram would make that clear.
- **Comparison to other people's models.** Only fair on the same test set and metric. Sun, Tao and Bi's Manchu ancient book words dataset is the natural match if published work reports results on it. Use the same split and exact-word accuracy, or say clearly where they differ.

### Inside the model

- **Top-k letters per token (backend).** Hovering a token would show its 2–3 most likely letters with probabilities, not only the winner. The common confusions would show up directly. `/random` currently returns only the top letter and its probability.
- **Logit lens (backend).** Apply the output head after each of the 8 transformer blocks to show at which layer each letter appears. It could reuse the token-band display, with one strip per layer.
- **Attention maps (backend).** Return the attention weights from `MultiHeadAttention`. Hovering a token would show which image rows it looked at, per layer and head.

### Using the demo

- **Read your own image (backend).** Upload or crop a single word and see every model's reading. This can come before the full `/ocr` pipeline, since one word needs no bounding boxes.
- **Links to a specific word, and a word browser.** A URL like `?photo=123` would make a striking example easy to share. A browser could filter the 300 photos, e.g. to words where the models disagree, or by word length.
- **Nearest dictionary word.** Show the closest lexicon entry beside the raw reading, never in place of it: the models must still read words that aren't in any lexicon.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
