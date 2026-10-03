export const metadata = {
  title: "GPT Text to Speech",
  description: "Convert text to speech with the Kevin Mac voice",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
