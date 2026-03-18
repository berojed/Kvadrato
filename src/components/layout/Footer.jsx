export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border mt-auto">
      <div className="container py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            &copy; {year} Kvadrato. Sva prava zadržana.
          </p>
          <p className="text-xs text-gray-400">
            Završni rad - Bernard Jedvaj &mdash; Fakultet informatike i digitalnih tehnologija
          </p>
        </div>
      </div>
    </footer>
  )
}
