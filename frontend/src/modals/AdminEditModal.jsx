import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
// createPortal(children, domNode) renders JSX into a different DOM node instead of inside its parent.
// The target is often document.body, so the output sits outside the parent’s DOM tree.
// It’s commonly used for modals, tooltips, and dropdowns.

// this function sets up the fields in the edit modal, 
// based on item type (user, movie, review)
function getInitialValues({ type, record }) { // we do object destructuring to get type & record.
  if (type === 'user') { // if item type is user then return 
    // the below object as form input fields in the edit modal to show. 
    return {
      name: record.name || '',
      email: record.email || '',
      role: record.role || 'user',
      password: '',
    }
  }

  if (type === 'movie') { // if item type is movie then return 
    // the below object as form input fields in the edit modal to show. 
    return {
      title: record.title || '',
      description: record.description || '',
      genre: record.genre || '',
      rating: record.rating == null ? '' : Number(record.rating).toFixed(1),
      release_year: record.release_year ?? '',
    }
  }
  // else, return below object for review type item as form input fields 
  // in the edit modal to show.
  return {
    rating: record.rating ?? '',
    review: record.review || '',
  }
}

function AdminEditModal({ item, onClose, onSave }) { // these parameters are data passed as params from parent (AdminHome.jsx)
  const [values, setValues] = useState(() => getInitialValues(item)) // state to hold form input fields, 
  // initialized based on the item type and record
  // The parent removes the modal immediately when onClose() is called.
  const onCloseRef = useRef(onClose)
  const [isSaving, setIsSaving] = useState(false) // state to hold if form is being saved,
  // used to disable the save button and show a loading state
  const [saveError, setSaveError] = useState('') // state to hold any error message from the save operation,
  const typeLabel = item.type === 'user' ? 'user' : item.type === 'movie' ? 'movie' : 'review' // used to display correct label,
  // in the modal header and save button text based on the item type
  const isCreating = item.mode === 'create' // bool variable to determine if modal is in create or edit mode, 
  // based on the item.mode prop

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // this useEffect locks the page from scrolling when the modal is open, 
  // and restores the scroll position when the modal is closed.
  useEffect(() => {
    const scrollY = window.scrollY // to store current vertical scroll position,
    // so we can restore it when modal closes
    const previousBodyStyles = { // object used as a backup box that stores the body’s original inline style values
      // so we can restore them when modal closes
      // document.body is the body element of the webpage.
      // .style is the body's inline styles 
      // position is the CSS position value (static, fixed, etc) that decides how the body is placed
      // top is how far the body is pushed from the top of the screen
      // left is how far the body is pushed from the left of the screen
      // right is how far the body is pushed from the right of the screen
      // width is the width of the body
      // overflow is what happens to content that goes beyond the body (hidden stops scrolling, auto allows it)
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow, // overflow is set to hidden to prevent scrolling when modal is open
    }
    // below pins body to the screen, so the page behind the modal can't scroll
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px` // Setting top to a negative value (-scrollY) 
    // pushes the body back up by exactly the distance the user had scrolled
    document.body.style.left = '0' // pins the body to the left edge of the screen
    document.body.style.right = '0' // pins the body to the right edge of the screen
    document.body.style.width = '100%' // ensures the body takes up the full width of the viewport
    document.body.style.overflow = 'hidden' // prevents any scrolling on the body while the modal is open

    const handleKeyDown = (event) => { // this is when user clicks on escape key, modal closes
      if (event.key === 'Escape') {
        onCloseRef.current()
      }
    }

    document.addEventListener('keydown', handleKeyDown) // this add event listener for key press, 
    // it then runs the associated function handleKeyDown() when a key is pressed.

    return () => {
      Object.assign(document.body.style, previousBodyStyles) // this restores the original body styles upon closing modal.
      document.removeEventListener('keydown', handleKeyDown) // when effect completes, remove event listener
      window.scrollTo(0, scrollY) // restores scroll position on page to where it was, before modal opened
    }
  }, []) // this effect runs only when component first mounts. 

  // this updates fields in modal upon user input
  const updateValue = (event) => { 
    const { name, value } = event.target
    setValues((currentValues) => ({ ...currentValues, [name]: value }))
  }

  // this function handles the IMDb rating input for movies, 
  // ensuring that the value is formatted correctly as the user types.
  const updateMovieRating = (event) => {
    const input = event.target // DOM element that triggered the event
    const value = input.value.replace(/[^\d.]/g, '') // the regex means replace any character that isn't a digit or a period
    // with empty character, effectively removing it from the input value. Thus, user can only enter digits and dot.
    let formattedValue // variable to hold formatted value of rating input field

    if (value.includes('.')) { // if value includes a dot, split the value into whole and decimal parts
      const [whole = '0', ...decimals] = value.split('.') // split() returns an array of strings, 
      // where the first element is the whole part and the rest are decimal parts.
      formattedValue = `${whole}.${decimals.join('').slice(0, 1)}` // decimals.join() joins the decimal parts into a single string, 
      // and slice(0, 1) takes only the first character of that string, ie first decimal place only.
    } else if (value.length === 2 && value !== '10') { // if value is two digits and not 10, format it as X.X
      formattedValue = `${value[0]}.${value[1]}`
    } else if (value.length === 2 && value === '10') {
      formattedValue = '9.9' // if value is exactly 10, format it as 9.9
    }

    // update the rating field in values state with the formatted value
    setValues((currentValues) => ({ ...currentValues, rating: formattedValue })) 
  }
  // this function handles the review rating input, ensuring that the value is a single digit between 1 and 5, or empty
  const updateReviewRating = (event) => {
    const { value } = event.target
    if (/^[1-5]?$/.test(value)) { // update rating field only if input value is a single digit between 1 and 5, or empty
      setValues((currentValues) => ({ ...currentValues, rating: value }))
    }
  }

  // this function handles the form submission, calls onSave prop with the current values,
  const handleSubmit = async (event) => {
    event.preventDefault() 
    setIsSaving(true) // flag to indicate that form is being saved
    setSaveError('') // initialise saveError to empty string

    try {
      await onSave(values) // calls the onSave prop function passed from AdminHome.jsx, which updates the item in the database
      onClose() // onClose() is function passed as prop here, it sets the editingItem state in AdminHome to null.
    } catch (error) {
      setSaveError(error.message)
    } finally {
      setIsSaving(false) // flag to indicate that form is no longer being saved
    }
  }

  return createPortal( // this renders the modal JSX 
    // into a different place in the DOM than where the component normally sits
    <div
      className="admin-edit-overlay" // the parent removes the modal immediately when onClose() is called
    >
      <section
        className="admin-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-edit-title"
      >
        <header className="admin-edit-header">
          <div>
            <h2 id="admin-edit-title">{isCreating ? 'Add' : 'Edit'} {typeLabel}</h2> {/* Display if editing or creating an item */}
          </div>
          <button
            className="admin-edit-close"
            type="button"
            aria-label="Close edit dialog"
            onClick={onClose} // event emitter that closes the modal when close button clicked.
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <form className={`admin-edit-form admin-edit-form-${item.type}`} onSubmit={handleSubmit}>
          {item.type === 'user' && ( // if item type is user, then render below JSX for the form fields in the modal.
            <>
              <label className="admin-edit-field admin-edit-user-name">
                <span>Full name <em className="required-asterisk" aria-hidden="true">*</em></span>
                <input
                  autoFocus
                  autoComplete="name"
                  name="name"
                  onChange={updateValue} // event emitter to update the values state when user types in the input field
                  required
                  value={values.name}
                />
              </label>
              <label className="admin-edit-field admin-edit-user-email">
                <span>Email address <em className="required-asterisk" aria-hidden="true">*</em></span>
                <input
                  autoComplete="email"
                  name="email"
                  onChange={updateValue} // event emitter to update the values state when user types in the input field
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
                  onChange={updateValue} // event emitter to update the values state when user types in the input field
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

          {item.type === 'movie' && ( // if item type is movie, then render below JSX for the form fields in the modal.
            <>
              <label className="admin-edit-field admin-edit-movie-title">
                <span>Movie title <em className="required-asterisk" aria-hidden="true">*</em></span>
                <input
                  autoFocus
                  name="title"
                  onChange={updateValue} // event emitter to update the values state when user types in the input field
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
                  onChange={updateValue} // event emitter to update the values state when user types in the input field
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
                  onChange={updateMovieRating} // event emitter to update imdb rating field in values state upon user input.
                  pattern="(?:10|[0-9])\.[0-9]"
                  placeholder="e.g. 7.5"
                  required={isCreating}
                  title="Enter the rating in X.X format, from 0.0 to 9.9."
                  type="text"
                  value={values.rating}
                />
              </label>
              <label className="admin-edit-field admin-edit-movie-description">
                <span>Description <em className="required-asterisk" aria-hidden="true">*</em></span>
                <textarea
                  name="description"
                  onChange={updateValue} // event emitter to update description field in values state upon user input.
                  required={isCreating}
                  rows="3"
                  value={values.description}
                />
              </label>
            </>
          )}

          {item.type === 'review' && ( // else, if item type is review, then render below JSX for the form fields in the modal.
            <>
              <label className="admin-edit-field admin-edit-review-rating">
                <span>Rating <small>1–5 stars</small></span>
                <input
                  inputMode="numeric"
                  maxLength="1"
                  name="rating"
                  onChange={updateReviewRating} // event emitter to update rating field in values state upon user input.
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
                  onChange={updateValue} // event emitter to update review field in values state upon user input.
                  required
                  rows="3"
                  value={values.review}
                />
              </label>
            </>
          )}

          {saveError && <p className="admin-edit-error" role="alert">{saveError}</p>} {/* display save error when the error occurs */}
          <footer className="admin-edit-footer">
            <button className="admin-edit-cancel" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="admin-edit-save" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : isCreating ? `Add ${typeLabel}` : 'Save changes'}
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body // document.body is the container: the <body> element of the page
  )
}

// meaning the modal’s HTML is placed directly inside <body>, 
// even though the component is written deep inside your other components

export default AdminEditModal
