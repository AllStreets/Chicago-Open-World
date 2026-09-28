// app/src/world/SafeLoad.jsx — error boundary for loaders: one failed file never blanks the app.
import { Component } from 'react'

export default class SafeLoad extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error) { this.props.onError?.(error) }
  render() { return this.state.failed ? (this.props.fallback ?? null) : this.props.children }
}
