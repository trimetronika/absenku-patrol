import React from "react";

export const metadata = {
  title: "Absenku - Super Admin & Company Admin Dashboard",
  description: "AI-Powered Digital Patrol Management System for Security Guard Operations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: "#090d16", color: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
