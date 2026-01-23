-- Add system design evaluation scores to evaluations table

-- System design specific scoring dimensions
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS requirements_gathering_score INT;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS system_components_score INT;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS scalability_score INT;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS data_model_score INT;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS api_design_score INT;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS trade_offs_score INT;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS communication_score INT;

-- Add check constraints for new scores (0-100 range)
ALTER TABLE evaluations
ADD CONSTRAINT eval_requirements_gathering_range
CHECK (requirements_gathering_score IS NULL OR (requirements_gathering_score >= 0 AND requirements_gathering_score <= 100));

ALTER TABLE evaluations
ADD CONSTRAINT eval_system_components_range
CHECK (system_components_score IS NULL OR (system_components_score >= 0 AND system_components_score <= 100));

ALTER TABLE evaluations
ADD CONSTRAINT eval_scalability_range
CHECK (scalability_score IS NULL OR (scalability_score >= 0 AND scalability_score <= 100));

ALTER TABLE evaluations
ADD CONSTRAINT eval_data_model_range
CHECK (data_model_score IS NULL OR (data_model_score >= 0 AND data_model_score <= 100));

ALTER TABLE evaluations
ADD CONSTRAINT eval_api_design_range
CHECK (api_design_score IS NULL OR (api_design_score >= 0 AND api_design_score <= 100));

ALTER TABLE evaluations
ADD CONSTRAINT eval_trade_offs_range
CHECK (trade_offs_score IS NULL OR (trade_offs_score >= 0 AND trade_offs_score <= 100));

ALTER TABLE evaluations
ADD CONSTRAINT eval_communication_range
CHECK (communication_score IS NULL OR (communication_score >= 0 AND communication_score <= 100));

-- Snapshot of what was evaluated (for system design)
ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS evaluated_drawing JSONB;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS evaluated_notes TEXT;

-- Comments for documentation
COMMENT ON COLUMN evaluations.requirements_gathering_score IS 'System design: Did they clarify requirements? (0-100)';
COMMENT ON COLUMN evaluations.system_components_score IS 'System design: Correct high-level components? (0-100)';
COMMENT ON COLUMN evaluations.scalability_score IS 'System design: Addressed scaling concerns? (0-100)';
COMMENT ON COLUMN evaluations.data_model_score IS 'System design: Good data model design? (0-100)';
COMMENT ON COLUMN evaluations.api_design_score IS 'System design: Clean API contracts? (0-100)';
COMMENT ON COLUMN evaluations.trade_offs_score IS 'System design: Discussed trade-offs? (0-100)';
COMMENT ON COLUMN evaluations.communication_score IS 'System design: Clear explanation? (0-100)';
COMMENT ON COLUMN evaluations.evaluated_drawing IS 'Snapshot of Excalidraw diagram at evaluation time';
COMMENT ON COLUMN evaluations.evaluated_notes IS 'Snapshot of user notes at evaluation time';
