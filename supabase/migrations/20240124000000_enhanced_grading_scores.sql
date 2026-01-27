-- Add enhanced grading for system design evaluations
-- New approach: Qualitative ratings (Style + Completeness) instead of numeric scores

-- Qualitative ratings
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS style_rating TEXT;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS completeness_rating TEXT;

-- Numeric scores (for backward compatibility)
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS clarity_score INT;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS structure_score INT;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS correctness_score INT;

-- Add check constraints for ratings
ALTER TABLE evaluations
ADD CONSTRAINT eval_style_rating_values
CHECK (style_rating IS NULL OR style_rating IN ('strong', 'adequate', 'needs_improvement'));

ALTER TABLE evaluations
ADD CONSTRAINT eval_completeness_rating_values
CHECK (completeness_rating IS NULL OR completeness_rating IN ('comprehensive', 'adequate', 'incomplete'));

-- Add check constraints for numeric scores (0-100 range)
ALTER TABLE evaluations
ADD CONSTRAINT eval_clarity_range
CHECK (clarity_score IS NULL OR (clarity_score >= 0 AND clarity_score <= 100));

ALTER TABLE evaluations
ADD CONSTRAINT eval_structure_range
CHECK (structure_score IS NULL OR (structure_score >= 0 AND structure_score <= 100));

ALTER TABLE evaluations
ADD CONSTRAINT eval_correctness_range
CHECK (correctness_score IS NULL OR (correctness_score >= 0 AND correctness_score <= 100));

-- Comments for documentation
COMMENT ON COLUMN evaluations.style_rating IS 'System design: Qualitative rating of style (strong/adequate/needs_improvement)';
COMMENT ON COLUMN evaluations.completeness_rating IS 'System design: Qualitative rating of completeness (comprehensive/adequate/incomplete)';
COMMENT ON COLUMN evaluations.clarity_score IS 'System design: Numeric clarity score for backward compatibility (0-100)';
COMMENT ON COLUMN evaluations.structure_score IS 'System design: Numeric structure score for backward compatibility (0-100)';
COMMENT ON COLUMN evaluations.correctness_score IS 'System design: Numeric correctness score for backward compatibility (0-100)';
