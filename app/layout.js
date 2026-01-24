export const metadata = {
  title: 'Gazette Insolvency Feed',
  description: 'Monitor UK insolvencies, liquidations, and winding up petitions',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        margin: 0,
        padding: 0,
        backgroundColor: '#000'
      }}>
        {children}
      </body>
    </html>
  )
}
