export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-100 mt-auto bg-white">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400 font-medium">
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
