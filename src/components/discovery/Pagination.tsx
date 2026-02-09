import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  // Don't render if there's only one page or no pages
  if (totalPages <= 1) {
    return null
  }

  const handlePageChange = (page: number) => {
    if (page === currentPage) return
    if (page < 1 || page > totalPages) return
    onPageChange(page)
  }

  const generatePageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const maxVisiblePages = 7

    // Show all pages if totalPages <= 7
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
      return pages
    }

    // Always show first page
    pages.push(1)

    // Calculate the range around current page
    const showLeftEllipsis = currentPage > 4
    const showRightEllipsis = currentPage < totalPages - 3

    if (!showLeftEllipsis) {
      // Near the start: 1 2 3 4 5 ... 15
      for (let i = 2; i <= 5; i++) {
        pages.push(i)
      }
      pages.push('ellipsis')
      pages.push(totalPages)
    } else if (!showRightEllipsis) {
      // Near the end: 1 ... 11 12 13 14 15
      pages.push('ellipsis')
      for (let i = totalPages - 4; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // In the middle: 1 ... 4 5 6 ... 15
      pages.push('ellipsis')
      pages.push(currentPage - 1)
      pages.push(currentPage)
      pages.push(currentPage + 1)
      pages.push('ellipsis')
      pages.push(totalPages)
    }

    return pages
  }

  const pageNumbers = generatePageNumbers()

  return (
    <nav role="navigation" aria-label="Pagination" className="flex items-center justify-center gap-1">
      {/* Previous Button */}
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Page Numbers */}
      {pageNumbers.map((page, index) => {
        if (page === 'ellipsis') {
          return (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-sm text-muted-foreground"
              aria-hidden="true"
            >
              ...
            </span>
          )
        }

        const isCurrentPage = page === currentPage

        return (
          <Button
            key={page}
            variant={isCurrentPage ? 'default' : 'ghost'}
            size="icon-sm"
            onClick={() => handlePageChange(page)}
            aria-label={String(page)}
            aria-current={isCurrentPage ? 'page' : undefined}
            className={cn(
              'min-w-8',
              !isCurrentPage && 'text-muted-foreground hover:text-foreground'
            )}
          >
            {page}
          </Button>
        )
      })}

      {/* Next Button */}
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}
