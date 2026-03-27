import { Component } from 'react'

/**
 * Error boundary for the 3D viewer – prevents WebGL failures from crashing the page.
 * Shared between public PropertyDetailPage and seller SellerPropertyDetailPage.
 */
export default class Viewer3DErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(err) {
    if (import.meta.env.DEV) console.warn('[3DViewer] Nedostupno:', err.message)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" onClick={this.props.onClose} />
          <div className="relative bg-gray-950 rounded-xl p-10 text-center z-10">
            <p className="text-white font-semibold mb-2">3D preglednik nije dostupan</p>
            <p className="text-sm text-gray-400 mb-4">Vaš preglednik ne podržava WebGL.</p>
            <button onClick={this.props.onClose} className="btn btn-secondary text-sm">Zatvori</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
