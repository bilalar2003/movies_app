import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function AdminConfirmModal({ item, onCancel, onConfirm }) {
  const [isClosing, setIsClosing] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const itemLabel = item.type === 'user' ? 'user' : item.type === 'movie' ? 'movie' : 'review'
  const itemName = item.type === 'user'
    ? item.record.name
    : item.type === 'movie'
      ? item.record.title
      : item.record.movie_title

  useEffect(() => {
    const scrollY = window.scrollY
    const previousBodyStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    }
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsClosing(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      Object.assign(document.body.style, previousBodyStyles)
      document.removeEventListener('keydown', handleKeyDown)
      window.scrollTo(0, scrollY)
    }
  }, [])

  const closeModal = () => setIsClosing(true)
  const confirmRemoval = () => {
    setIsConfirmed(true)
    setIsClosing(true)
  }

  const message = item.type === 'user'
    ? 'Are you sure you want to remove this user from the app? All associated data will be erased.'
    : `Are you sure you want to remove this ${itemLabel}?`

  return createPortal(
    <div
      className={`admin-edit-overlay admin-confirm-overlay${isClosing ? ' is-closing' : ''}`}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'admin-edit-fade-out') {
          if (isConfirmed) {
            onConfirm()
          } else {
            onCancel()
          }
        }
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isClosing) {
          closeModal()
        }
      }}
    >
      <section
        className="admin-edit-modal admin-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby="admin-confirm-message"
      >
        <header className="admin-edit-header">
          <div>
            <h2 id="admin-confirm-title">Remove {itemLabel}</h2>
          </div>
          <button
            className="admin-edit-close"
            type="button"
            aria-label="Close confirmation dialog"
            onClick={closeModal}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <p className="admin-confirm-message" id="admin-confirm-message">{message}</p>
        {itemName && <p className="admin-confirm-item-name">{itemName}</p>}

        <footer className="admin-edit-footer admin-confirm-footer">
          <button className="admin-edit-cancel" type="button" onClick={closeModal}>
            Discard
          </button>
          <button className="admin-confirm-remove" type="button" onClick={confirmRemoval}>
            Confirm
          </button>
        </footer>
      </section>
    </div>,
    document.body
  )
}

export default AdminConfirmModal
