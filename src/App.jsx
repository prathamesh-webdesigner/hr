import { useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'https://hr-production-d907.up.railway.app'

function App() {
  const [keyword, setKeyword] = useState('')
  const [documents, setDocuments] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedFile, setSelectedFile] = useState(null)
  const [status, setStatus] = useState('Upload resumes, spreadsheets, or documents to index them for keyword search.')
  const [loading, setLoading] = useState(false)

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`${API_URL}/documents`)
      const data = await response.json()
      setDocuments(data)
      setCurrentPage(1)
    } catch (error) {
      console.error(error)
      setStatus('Unable to load indexed documents from the server.')
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const handleUpload = async (event) => {
    event.preventDefault()

    if (!selectedFile) {
      setStatus('Choose a file before uploading.')
      return
    }

    setLoading(true)
    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json()
      setStatus(payload.message || 'Upload complete.')
      setSelectedFile(null)
      event.target.reset()
      await fetchDocuments()
    } catch (error) {
      console.error(error)
      setStatus('Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (event) => {
    event.preventDefault()
    setLoading(true)

    try {
      const url = new URL(`${API_URL}/search`)
      url.searchParams.set('keyword', keyword)
      const response = await fetch(url)
      const data = await response.json()
      setDocuments(data)
      setCurrentPage(1)
      setStatus(keyword ? `Showing ${data.length} matching document${data.length === 1 ? '' : 's'}.` : 'Showing all indexed documents.')
    } catch (error) {
      console.error(error)
      setStatus('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Pagination
  const pageSize = 6 // 3 columns x 2 rows
  const totalPages = Math.max(1, Math.ceil(documents.length / pageSize))
  const startIndex = (currentPage - 1) * pageSize
  const pagedDocuments = documents.slice(startIndex, startIndex + pageSize)

  const gotoPage = (p) => {
    const next = Math.min(Math.max(1, p), totalPages)
    setCurrentPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDownload = (document) => {
    window.open(`${API_URL}/download/${document.id}`, '_blank')
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">AI-ready document portal</p>
          <h1>Upload and search resumes and files instantly</h1>
          <p className="subtitle">
            Upload PDF, Word, Excel, or plain text files and search by keywords like JavaScript, React, or SQL.
          </p>
        </div>

        <form className="upload-card" onSubmit={handleUpload}>
          <label className="upload-label" htmlFor="fileInput">
            Upload a document
          </label>
          <input
            id="fileInput"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Uploading...' : 'Upload and index'}
          </button>
        </form>
      </section>

      <section className="search-card">
        <form onSubmit={handleSearch} className="search-form">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Search for a keyword, skill, or title"
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        <p className="status">{status}</p>

        <div className="results-grid">
          {pagedDocuments.map((document) => (
            <article key={document.id} className="result-card">
              <div className="result-header">
                <h2>{document.name}</h2>
                <button type="button" className="download-btn" onClick={() => handleDownload(document)}>
                  Download
                </button>
              </div>
              <p className="meta">{document.type || 'document'}</p>
              <p className="preview">
                {document.text ? `${document.text.slice(0, 220)}${document.text.length > 220 ? '...' : ''}` : 'No content extracted.'}
              </p>
            </article>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => gotoPage(currentPage - 1)} disabled={currentPage === 1}>
              Prev
            </button>

            <div className="pages">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  className={i + 1 === currentPage ? 'active' : ''}
                  onClick={() => gotoPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button onClick={() => gotoPage(currentPage + 1)} disabled={currentPage === totalPages}>
              Next
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
