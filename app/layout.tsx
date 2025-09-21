export const metadata = {
  title: 'MCP Store Server',
  description: 'Meta-layer MCP server for routing and discovery',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}