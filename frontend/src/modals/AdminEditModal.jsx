import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function getInitialValues({ type, record }) {
  if (type === 'user') {
    return {
      name: record.name || '',
      email: record.email || '',
      role: record.role || 'user',
      password: '',
    }
  }

  if (type === 'movie') {
    return {
      title: record.title || '',
      description: record.description || '',
      genre: record.genre || '',
      rating: record.rating == null ? '' : Number(record.rating).toFixed(1),
      release_year: record.release_year ?? '',
    }
  }

  return {
    rating: record.rating ?? '',
    review: record.review || '',
  }
}

function AdminEditModal({ item, onClose, onSave }) {
  const [values, setValues] = useState(() => getInitialValues(item))
  const [isClosing, setIsClosing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const typeLabel = item.type === 'user' ? 'user' : item.type === 'movie' ? 'movie' : 'review'
  const isCreating = item.mode === 'create'

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

  const updateValue = (event) => {
    const { name, value } = event.target
    setValues((currentValues) => ({ ...currentValues, [name]: value }))
  }

  const updateMovieRating = (event) => {
    const input = event.target
    const value = input.value.replace(/[^\d.]/g, '')
    const decimalIndex = value.indexOf('.')
    let formattedValue

    if (decimalIndex !== -1) {
      const wholeNumber = value.slice(0, decimalIndex) || '0'
      const decimal = value.slice(decimalIndex + 1).replace(/\./g, '').slice(0, 1)
      formattedValue = `${wholeNumber}.${decimal}`
    } else if (value.length === 2 && value !== '10') {
      formattedValue = `${value[0]}.${value[1]}`
    } else if (value.length === 3 && value.startsWith('10')) {
      formattedValue = `10.${value[2]}`
    } else {
      formattedValue = value.slice(0, 2)
    }

    setValues((currentValues) => ({ ...currentValues, rating: formattedValue }))
    requestAnimationFrame(() => input.setSelectionRange(formattedValue.length, formattedValue.length))
  }

  const updateReviewRating = (event) => {
    const { value } = event.target
    if (/^[1-5]?$/.test(value)) {
      setValues((currentValues) => ({ ...currentValues, rating: value }))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setSaveError('')

    try {
      await onSave(values)
      setIsClosing(true)
    } catch (error) {
      setSaveError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return createPortal(
    <div
      className={`admin-edit-overlay${isClosing ? ' is-closing' : ''}`}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'admin-edit-fade-out') {
          onClose()
        }
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isClosing) {
          setIsClosing(true)
        }
      }}
    >
      <section
        className="admin-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-edit-title"
      >
        <header className="admin-edit-header">
          <div>
            <h2 id="admin-edit-title">{isCreating ? 'Add' : 'Edit'} {typeLabel}</h2>
          </div>
          <button
            className="admin-edit-close"
            type="button"
            aria-label="Close edit dialog"
            onClick={() => setIsClosing(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <form className={`admin-edit-form admin-edit-form-${item.type}`} onSubmit={handleSubmit}>
          {item.type === 'user' && (
            <>
              <label className="admin-edit-field admin-edit-user-name">
                <span>Full name <em className="required-asterisk" aria-hidden="true">*</em></span>
                <input
                  autoFocus
                  autoComplete="name"
                  name="name"
                  onChange={updateValue}
                  required
                  value={values.name}
                />
              </label>
              <label className="admin-edit-field admin-edit-user-email">
                <span>Email address <em className="required-asterisk" aria-hidden="true">*</em></span>
                <input
                  autoComplete="email"
                  name="email"
                  onChange={updateValue}
                  required
                  type="email"
                  value={values.email}
                />
              </label>
              <label className="admin-edit-field admin-edit-user-role">
                <span>Role</span>
                <select
                  name="role"
                  value="user"
                  disabled
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    backgroundImage: 'none',
                    pointerEvents: 'none',
                    opacity: 0.6, 
                    cursor: 'not-allowed'
                  }}
                >
                  <option value="user">User</option>
                </select>
              </label>
              <label className="admin-edit-field admin-edit-user-password">
                <span>
                  {isCreating ? 'Password' : 'New password'}
                  {isCreating
                    ? <em className="required-asterisk" aria-hidden="true">*</em>
                    : <small>Optional</small>}
                </span>
                <input
                  autoComplete="new-password"
                  name="password"
                  onChange={updateValue}
                  placeholder={isCreating ? 'Create a password' : 'Enter a new password'}
                  type="password"
                  minLength={isCreating ? 5 : undefined}
                  pattern={isCreating ? '(?=.*[^A-Za-z0-9\\s]).{5,}' : undefined}
                  required={isCreating}
                  title="Password must be at least 5 characters and include a special character."
                  value={values.password}
                />
                {!isCreating && (
                  <small className="admin-edit-hint">
                    Leave blank to keep the current password.
                  </small>
                )}
              </label>
            </>
          )}

          {item.type === 'movie' && (
            <>
              <label className="admin-edit-field admin-edit-movie-title">
                <span>Movie title <em className="required-asterisk" aria-hidden="true">*</em></span>
                <input
                  autoFocus
                  name="title"
                  onChange={updateValue}
                  required
                  value={values.title}
                />
              </label>
              <label className="admin-edit-field admin-edit-movie-genre">
                <span>Genre <em className="required-asterisk" aria-hidden="true">*</em></span>
                <input name="genre" onChange={updateValue} required={isCreating} value={values.genre} />
              </label>
              <label className="admin-edit-field admin-edit-movie-year">
                <span>Release year <em className="required-asterisk" aria-hidden="true">*</em></span>
                <input
                  max="9999"
                  min="1888"
                  name="release_year"
                  onChange={updateValue}
                  required={isCreating}
                  type="number"
                  value={values.release_year}
                />
              </label>
              <label className="admin-edit-field admin-edit-movie-rating">
                <span>IMDb rating <em className="required-asterisk" aria-hidden="true">*</em><small>0–10</small></span>
                <input
                  inputMode="decimal"
                  maxLength="4"
                  name="rating"
                  onChange={updateMovieRating}
                  pattern="(?:10|[0-9])\.[0-9]"
                  placeholder="e.g. 7.5"
                  required={isCreating}
                  title="Enter the rating in X.X format, from 0.0 to 10.0."
                  type="text"
                  value={values.rating}
                />
              </label>
              <label className="admin-edit-field admin-edit-movie-description">
                <span>Description <em className="required-asterisk" aria-hidden="true">*</em></span>
                <textarea
                  name="description"
                  onChange={updateValue}
                  required={isCreating}
                  rows="3"
                  value={values.description}
                />
              </label>
            </>
          )}

          {item.type === 'review' && (
            <>
              <label className="admin-edit-field admin-edit-review-rating">
                <span>Rating <small>1–5 stars</small></span>
                <input
                  inputMode="numeric"
                  maxLength="1"
                  name="rating"
                  onChange={updateReviewRating}
                  pattern="[1-5]"
                  required
                  title="Enter a single digit from 1 to 5."
                  type="text"
                  value={values.rating}
                />
              </label>
              <label className="admin-edit-field admin-edit-review-content">
                <span>Review</span>
                <textarea
                  maxLength="1000"
                  name="review"
                  onChange={updateValue}
                  required
                  rows="3"
                  value={values.review}
                />
              </label>
            </>
          )}

          {saveError && <p className="admin-edit-error" role="alert">{saveError}</p>}
          <footer className="admin-edit-footer">
            <button className="admin-edit-cancel" type="button" onClick={() => setIsClosing(true)}>
              Cancel
            </button>
            <button className="admin-edit-save" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : isCreating ? `Add ${typeLabel}` : 'Save changes'}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body
  )
}

export default AdminEditModal
