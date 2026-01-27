/**
 * Shared Modal Styles for Website-Specific Novel Detail Modals
 * This provides a consistent base that all website handlers can extend
 */

/**
 * Get base modal styles that all sites can use
 * These styles ensure the modal looks good and is responsive
 */
export function getBaseModalStyles() {
	return `
		<style>
			/* Base Modal Container */
			.site-modal-grid {
				display: flex;
				flex-direction: column;
				gap: 16px;
				margin-top: 8px;
			}

			/* Primary Metadata Row */
			.site-modal-row {
				display: flex;
				flex-wrap: wrap;
				gap: 12px;
				align-items: flex-start;
			}

			.site-modal-row.primary-meta {
				padding: 12px 16px;
				background: rgba(255, 255, 255, 0.03);
				border-radius: 8px;
				border: 1px solid rgba(255, 255, 255, 0.05);
			}

			.site-modal-row .meta-group {
				display: flex;
				flex-direction: column;
				gap: 4px;
				min-width: 100px;
			}

			.site-modal-row .meta-label {
				font-size: 0.7rem;
				text-transform: uppercase;
				letter-spacing: 0.5px;
				color: #9ca3af;
				font-weight: 500;
			}

			/* Modal Sections */
			.site-modal-section {
				display: flex;
				flex-direction: column;
				gap: 10px;
				background: rgba(255, 255, 255, 0.02);
				border-radius: 8px;
				padding: 14px;
				border: 1px solid rgba(255, 255, 255, 0.05);
			}

			.site-modal-section .modal-section-title {
				font-size: 0.9rem;
				font-weight: 600;
				margin: 0 0 6px 0;
				padding-bottom: 6px;
				border-bottom: 1px solid rgba(255, 255, 255, 0.1);
				color: #e5e7eb;
				letter-spacing: 0.3px;
			}

			/* Stats Grid */
			.site-stats-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
				gap: 10px;
			}

			.modal-stat-item {
				display: flex;
				flex-direction: column;
				gap: 4px;
				padding: 10px 12px;
				background: rgba(255, 255, 255, 0.04);
				border-radius: 6px;
				border: 1px solid rgba(255, 255, 255, 0.06);
				transition: all 0.2s ease;
			}

			.modal-stat-item:hover {
				background: rgba(255, 255, 255, 0.06);
				border-color: rgba(255, 255, 255, 0.1);
			}

			.modal-stat-label {
				font-size: 0.75rem;
				color: #9ca3af;
				font-weight: 500;
			}

			.modal-stat-value {
				font-size: 1rem;
				font-weight: 600;
				color: #e5e7eb;
			}

			/* Tags List */
			.tags-list {
				display: flex;
				flex-wrap: wrap;
				gap: 7px;
			}

			.tags-list .tag {
				display: inline-flex;
				align-items: center;
				padding: 5px 12px;
				border-radius: 6px;
				font-size: 0.8rem;
				font-weight: 500;
				background: rgba(255, 255, 255, 0.06);
				color: #d1d5db;
				border: 1px solid rgba(255, 255, 255, 0.1);
				transition: all 0.2s ease;
			}

			.tags-list .tag:hover {
				background: rgba(255, 255, 255, 0.09);
				border-color: rgba(255, 255, 255, 0.15);
				transform: translateY(-1px);
			}

			.tags-list .no-data {
				color: #6b7280;
				font-style: italic;
				font-size: 0.85rem;
			}

			/* Chip/Badge Styles */
			.chip {
				display: inline-flex;
				align-items: center;
				padding: 4px 10px;
				border-radius: 5px;
				font-size: 0.75rem;
				font-weight: 600;
				border: 1px solid transparent;
				transition: all 0.2s ease;
			}

			.chip-ghost {
				background: rgba(255, 255, 255, 0.08);
				color: #9ca3af;
				border-color: rgba(255, 255, 255, 0.1);
			}

			.chip-primary {
				background: rgba(59, 130, 246, 0.2);
				color: #93c5fd;
				border-color: rgba(59, 130, 246, 0.3);
			}

			.chip-success {
				background: rgba(34, 197, 94, 0.2);
				color: #86efac;
				border-color: rgba(34, 197, 94, 0.3);
			}

			.chip-warning {
				background: rgba(251, 191, 36, 0.2);
				color: #fde047;
				border-color: rgba(251, 191, 36, 0.3);
			}

			.chip-error {
				background: rgba(239, 68, 68, 0.2);
				color: #fca5a5;
				border-color: rgba(239, 68, 68, 0.3);
			}

			.chip-info {
				background: rgba(168, 85, 247, 0.2);
				color: #d8b4fe;
				border-color: rgba(168, 85, 247, 0.3);
			}

			/* Responsive Design */
			@media (max-width: 768px) {
				.site-stats-grid {
					grid-template-columns: repeat(2, 1fr);
				}

				.site-modal-row.primary-meta {
					flex-direction: column;
					gap: 10px;
				}

				.site-modal-section {
					padding: 12px;
				}

				.modal-stat-item {
					padding: 8px 10px;
				}
			}

			@media (max-width: 480px) {
				.site-stats-grid {
					grid-template-columns: 1fr;
				}

				.tags-list .tag {
					font-size: 0.75rem;
					padding: 4px 10px;
				}
			}
		</style>
	`;
}

/**
 * Get AO3-specific styles
 */
export function getAO3Styles() {
	return `
		<style>
			/* AO3-specific tag colors */
			.tags-list .tag-fandom {
				background: rgba(153, 0, 0, 0.2);
				color: #ff8a80;
				border-color: rgba(153, 0, 0, 0.4);
			}

			.tags-list .tag-relationship {
				background: rgba(156, 39, 176, 0.2);
				color: #ce93d8;
				border-color: rgba(156, 39, 176, 0.4);
			}

			.tags-list .tag-character {
				background: rgba(33, 150, 243, 0.2);
				color: #90caf9;
				border-color: rgba(33, 150, 243, 0.4);
			}

			.tags-list .tag-warning {
				background: rgba(244, 67, 54, 0.25);
				color: #ef9a9a;
				border-color: rgba(244, 67, 54, 0.4);
				font-weight: 600;
			}

			.tags-list .tag-additional {
				background: rgba(76, 175, 80, 0.2);
				color: #a5d6a7;
				border-color: rgba(76, 175, 80, 0.3);
			}

			/* AO3 Rating Badges */
			.rating-badge.rating-general {
				background: linear-gradient(135deg, #77a02e, #5a7d23);
				color: #fff;
				border: none;
				box-shadow: 0 2px 4px rgba(119, 160, 46, 0.3);
			}

			.rating-badge.rating-teen {
				background: linear-gradient(135deg, #d4a90a, #a88408);
				color: #1a1a1a;
				border: none;
				box-shadow: 0 2px 4px rgba(212, 169, 10, 0.3);
			}

			.rating-badge.rating-mature {
				background: linear-gradient(135deg, #d4650a, #a85008);
				color: #fff;
				border: none;
				box-shadow: 0 2px 4px rgba(212, 101, 10, 0.3);
			}

			.rating-badge.rating-explicit {
				background: linear-gradient(135deg, #9e1414, #7a1010);
				color: #fff;
				border: none;
				box-shadow: 0 2px 4px rgba(158, 20, 20, 0.3);
			}

			.rating-badge.rating-not-rated {
				background: linear-gradient(135deg, #666, #555);
				color: #fff;
				border: none;
			}
		</style>
	`;
}

/**
 * Get FanFiction.net-specific styles
 */
export function getFanFictionStyles() {
	return `
		<style>
			/* FanFiction-specific tag colors */
			.tags-list .tag-fandom {
				background: rgba(42, 75, 141, 0.25);
				color: #90caf9;
				border-color: rgba(42, 75, 141, 0.5);
			}

			.tags-list .tag-genre {
				background: rgba(76, 175, 80, 0.2);
				color: #a5d6a7;
				border-color: rgba(76, 175, 80, 0.4);
			}

			.tags-list .tag-character {
				background: rgba(156, 39, 176, 0.2);
				color: #ce93d8;
				border-color: rgba(156, 39, 176, 0.4);
			}

			.tags-list .tag-source {
				background: rgba(255, 152, 0, 0.2);
				color: #ffb74d;
				border-color: rgba(255, 152, 0, 0.4);
			}

			/* FanFiction Rating Badges */
			.rating-badge.rating-k {
				background: linear-gradient(135deg, #4caf50, #388e3c);
				color: #fff;
				border: none;
				box-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
			}

			.rating-badge.rating-kp,
			.rating-badge.rating-k\\+ {
				background: linear-gradient(135deg, #8bc34a, #689f38);
				color: #1a1a1a;
				border: none;
				box-shadow: 0 2px 4px rgba(139, 195, 74, 0.3);
			}

			.rating-badge.rating-t {
				background: linear-gradient(135deg, #ffc107, #ffa000);
				color: #1a1a1a;
				border: none;
				box-shadow: 0 2px 4px rgba(255, 193, 7, 0.3);
			}

			.rating-badge.rating-m {
				background: linear-gradient(135deg, #ff9800, #f57c00);
				color: #fff;
				border: none;
				box-shadow: 0 2px 4px rgba(255, 152, 0, 0.3);
			}

			.chip-crossover {
				background: rgba(156, 39, 176, 0.25);
				color: #ce93d8;
				border-color: rgba(156, 39, 176, 0.4);
			}
		</style>
	`;
}

/**
 * Get Ranobes-specific styles
 */
export function getRanobesStyles() {
	return `
		<style>
			/* Ranobes-specific tag colors */
			.tags-list .tag-genre {
				background: rgba(74, 124, 78, 0.25);
				color: #a5d6a7;
				border-color: rgba(74, 124, 78, 0.4);
			}

			/* Ranobes Rating Badge */
			.rating-badge {
				background: linear-gradient(135deg, #4a7c4e, #3a5f3d);
				color: #fff;
				border: none;
				box-shadow: 0 2px 4px rgba(74, 124, 78, 0.3);
			}

			/* Ranobes-specific chip for translation status */
			.chip-translation-complete {
				background: rgba(34, 197, 94, 0.25);
				color: #86efac;
				border-color: rgba(34, 197, 94, 0.4);
			}

			.chip-translation-ongoing {
				background: rgba(251, 191, 36, 0.25);
				color: #fde047;
				border-color: rgba(251, 191, 36, 0.4);
			}

			.chip-translation-dropped {
				background: rgba(239, 68, 68, 0.25);
				color: #fca5a5;
				border-color: rgba(239, 68, 68, 0.4);
			}
		</style>
	`;
}

/**
 * Get ScribbleHub-specific styles
 */
export function getScribbleHubStyles() {
	return `
		<style>
			/* ScribbleHub-specific tag colors */
			.tags-list .tag-fandom {
				background: rgba(108, 92, 231, 0.2);
				color: #c4b5fd;
				border-color: rgba(108, 92, 231, 0.4);
			}

			.tags-list .tag-genre {
				background: rgba(139, 92, 246, 0.2);
				color: #d8b4fe;
				border-color: rgba(139, 92, 246, 0.4);
			}

			/* ScribbleHub Rating Badge */
			.rating-badge {
				background: linear-gradient(135deg, #6c5ce7, #5b4bc4);
				color: #fff;
				border: none;
				box-shadow: 0 2px 4px rgba(108, 92, 231, 0.3);
			}
		</style>
	`;
}
