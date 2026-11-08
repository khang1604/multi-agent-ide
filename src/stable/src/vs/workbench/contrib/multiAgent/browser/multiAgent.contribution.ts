/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { AgentMultiDiffContribution, OpenAgentMultiDiffEditorAction, UpdateAgentMultiDiffEntriesAction } from './agentMultiDiffSourceResolver.js';

// Multi Agent IDE Contributions (Tier 2: Native Continuous Multi-Diff)
registerAction2(OpenAgentMultiDiffEditorAction);
registerAction2(UpdateAgentMultiDiffEntriesAction);
registerWorkbenchContribution2(
	AgentMultiDiffContribution.ID,
	AgentMultiDiffContribution,
	WorkbenchPhase.BlockStartup
);
