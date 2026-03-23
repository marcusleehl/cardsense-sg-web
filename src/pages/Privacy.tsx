import Footer from '../components/Footer'

const sections = [
  {
    heading: '1. Our core privacy position',
    body: 'CardSense SG does not collect, store, or transmit any personal financial data. We never see your transactions. Your bank statements and spending data are processed entirely within your browser and are permanently discarded after categorisation is complete.',
  },
  {
    heading: '2. How your data is processed',
    body: 'When you upload a bank statement or Money Manager export, your file is read using standard browser technology (SheetJS for Excel files, PDF.js for PDFs). The raw file content — including all transaction descriptions, merchant names, and amounts — is processed in your device\'s memory and never transmitted to any server. Once your transactions are categorised into 11 spending categories, only the category-level percentage totals are retained in memory for the duration of your session — for example Dining 34%, Travel 12%. All individual transaction details, merchant names, and amounts are discarded at this point. When you close or refresh this tab, all session data is permanently deleted from your device\'s memory.',
  },
  {
    heading: '3. What we store in your browser',
    body: 'We store two items in your browser\'s localStorage solely to improve your experience: your card preferences including reward priority, income bracket, and existing cards held, and any manual category corrections you make to transactions. No transaction data, amounts, merchant names, or dates are ever stored. You can clear this at any time by clearing your browser\'s localStorage via your browser settings.',
  },
  {
    heading: '4. Personal data we do not collect',
    body: 'CardSense SG does not collect your name, NRIC, email address, phone number, or any other personal identifier. No account creation is required. We have no way to identify who you are.',
  },
  {
    heading: '5. Hosting and server logs',
    body: 'CardSense SG is hosted on Vercel (vercel.com). Vercel\'s servers may collect standard web server logs including IP addresses and browser type as part of normal hosting operations. We do not have access to or control over this data. Please refer to Vercel\'s privacy policy at vercel.com/legal/privacy-policy for details.',
  },
  {
    heading: '6. Referral commissions and bank redirects',
    body: 'CardSense SG is free to use. We may earn a referral commission from banks if you apply for and are approved for a card through our links. This commission does not influence our recommendations — cards are ranked purely by projected annual value based on your spending categories. When you click Apply Now you are redirected to the bank\'s official website. At that point you are subject to the bank\'s own privacy policy. CardSense SG does not transmit any of your spending data to banks or affiliate networks.',
  },
  {
    heading: '7. Cookies',
    body: 'CardSense SG does not use cookies. We use browser localStorage only as described in Section 3 above.',
  },
  {
    heading: '8. Minors',
    body: 'CardSense SG is not directed at persons under 18 years of age.',
  },
  {
    heading: '9. Changes to this policy',
    body: 'We may update this Privacy Policy from time to time. The effective date at the top of this page will reflect the date of the most recent update.',
  },
  {
    heading: '10. Contact',
    body: 'If you have any questions about this Privacy Policy or how your data is handled, please contact us at [email placeholder].',
  },
]

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F9FAFB' }}>
      <main className="flex-1 px-4 py-10 max-w-2xl mx-auto w-full">
        {/* Last updated */}
        <p className="text-xs mb-4" style={{ color: '#9CA3AF' }}>Last updated: 23 March 2026</p>

        {/* Page heading */}
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#1E3A5F', fontFamily: 'Inter, sans-serif' }}>
          Privacy Policy — CardSense SG
        </h1>

        {/* Operator */}
        <p className="text-sm mb-8 leading-relaxed" style={{ color: '#6B7280' }}>
          CardSense SG is operated by [Your Name], Singapore.{' '}
          Contact: [email placeholder]
        </p>

        {/* Sections */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-8">
          {sections.map((section) => (
            <div key={section.heading}>
              <h2 className="text-base font-semibold mb-2" style={{ color: '#1E3A5F', fontFamily: 'Inter, sans-serif' }}>
                {section.heading}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
                {section.body}
              </p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
