import Navigation from './Navigation'

export const metadata = {
  title: 'Administration List CRM',
  description: 'Insolvency intelligence and analytics platform',
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
        <Navigation />
        {children}
      </body>
    </html>
  )
}
