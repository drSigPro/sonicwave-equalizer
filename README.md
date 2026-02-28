<div align="center">
  <h1>🌊 SonicWave Equalizer</h1>
  <p><strong>Precision Audio Engine & Real-time Visualizer</strong></p>
</div>

SonicWave is a beautiful, advanced web-based audio equalizer and visualizer built with React, Vite, and the Web Audio API. It features real-time frequency analysis, customizable equalizer bands, and stunning visualizations.

## ✨ Features

- **Real-time Visualization**: Switch between Waveform, Frequency Spectrum, and Waterfall Spectrograms.
- **10-Band Equalizer**: Fine-tune your audio with precision controls from 32Hz to 16kHz.
- **Built-in Presets**: Quickly apply professional EQ curves like Acoustic, Bass Boost, Electronic, and more.
- **Multiple Input Sources**: 
  - Upload your own audio files.
  - Use live microphone input.
  - Test with built-in sample tracks (sine waves, noise, and music).
- **Stunning UI**: A sleek, dark-themed interface crafted with Tailwind CSS and Lucide React icons.

## 🚀 Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd sonicwave-equalizer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`.

## ☁️ Deploying to Vercel

Deploying this application to Vercel is extremely simple and fast. Vercel provides excellent out-of-the-box support for Vite + React applications.

### Option 1: Vercel Dashboard (Recommended)

1. **Push your code to GitHub:**
   Ensure your local repository is pushed to a new repository on your GitHub account.
2. **Log into Vercel:**
   Go to [Vercel](https://vercel.com/) and sign in with your GitHub account.
3. **Import Project:**
   - Click the **Add New...** button and select **Project**.
   - Find your `sonicwave-equalizer` repository from the list and click **Import**.
4. **Configure Project:**
   Vercel will automatically detect that this is a Vite project and configure the correct settings:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Deploy:**
   Click the **Deploy** button. Vercel will build and deploy your application. In less than a minute, you'll get a live URL!

### Option 2: Deploy with Vercel CLI

1. Install the Vercel CLI globally:
   ```bash
   npm i -g vercel
   ```
2. Run the deployment command from the project root:
   ```bash
   vercel
   ```
3. Follow the CLI prompts. It will set up and link the project, automatically taking care of the build configuration.

## 🛠️ Tech Stack

- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Audio Processing**: Native HTML5 Web Audio API

---
*Created using modern web technologies to give you full control over your audio experience.*
