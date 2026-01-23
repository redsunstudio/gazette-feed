export const metadata = {
  title: 'Gazette Insolvency Feed',
  description: 'Monitor UK insolvencies, liquidations, and winding up petitions',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{
        fontFamily: 'system-ui, sans-serif',
        margin: 0,
        padding: '20px',
        backgroundColor: '#f5f5f5',
        maxWidth: '900px',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        {children}
      </body>
    </html>
  )
}
