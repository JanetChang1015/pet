import {mkdirp, readdir, remove, stat, writeFile} from 'fs-extra';
import {
	cleanScratchDirectory,
	openWithScratchFile,
	scratchDirectoryPath
} from '../scratch-file';
import {shell} from 'electron';

jest.mock('electron');
jest.mock('fs-extra');

describe('scratchDirectoryPath', () => {
	it('returns a localized path to a Scratch directory under the Twine directory', () =>
		expect(scratchDirectoryPath()).toBe(
			'mock-electron-app-path-documents/common.appName/electron.scratchDirectoryName'
		));
});

describe('cleanScratchDirectoryPath', () => {
	const readdirMock = readdir as jest.Mock;
	const removeMock = remove as jest.Mock;
	const statMock = stat as jest.Mock;

	beforeEach(() => {
		jest.spyOn(console, 'log').mockReturnValue();
	});

	it('deletes .html files older than 3 days', async () => {
		readdirMock.mockResolvedValue([
			{isDirectory: () => false, name: 'deleteme.html'},
			{isDirectory: () => false, name: 'deleteme2.html'}
		]);
		statMock.mockImplementation((name: string) => {
			switch (name) {
				case 'mock-electron-app-path-documents/common.appName/electron.scratchDirectoryName/deleteme.html':
					// older than the limit by 1ms
					return {mtimeMs: Date.now() - 1001 * 60 * 60 * 24 * 3};
				case 'mock-electron-app-path-documents/common.appName/electron.scratchDirectoryName/deleteme2.html':
					// older by 1 day
					return {mtimeMs: Date.now() - 1000 * 60 * 60 * 24 * 4};
				default:
					throw new Error(`Asked to stat unmocked file: ${name}`);
			}
		});
		await cleanScratchDirectory();
		expect(removeMock.mock.calls).toEqual([
			[
				'mock-electron-app-path-documents/common.appName/electron.scratchDirectoryName/deleteme.html'
			],
			[
				'mock-electron-app-path-documents/common.appName/electron.scratchDirectoryName/deleteme2.html'
			]
		]);
	});

	it("doesn't delete a .html file less than 3 days old", async () => {
		readdirMock.mockResolvedValue([
			{isDirectory: () => false, name: 'dontdeleteme.html'},
			{isDirectory: () => false, name: 'dontdeleteme2.html'}
		]);
		statMock.mockImplementation((name: string) => {
			switch (name) {
				case 'mock-electron-app-path-documents/common.appName/electron.scratchDirectoryName/dontdeleteme.html':
					// younger than the limit by 1ms
					return {mtimeMs: Date.now() - 999 * 60 * 60 * 24 * 3};
				case 'mock-electron-app-path-documents/common.appName/electron.scratchDirectoryName/dontdeleteme2.html':
					// younger by 1 day
					return {mtimeMs: Date.now() - 1000 * 60 * 60 * 24 * 2};
				default:
					throw new Error(`Asked to stat unmocked file: ${name}`);
			}
		});
		await cleanScratchDirectory();
		expect(removeMock).not.toBeCalled();
	});

	it("doesn't delete an old file that has a non-.html suffix", async () => {
		readdirMock.mockResolvedValue([
			{isDirectory: () => false, name: 'dontdeleteme.txt'},
			{isDirectory: () => false, name: 'dontdeleteme2.jpeg'}
		]);
		statMock.mockImplementation(() => ({
			mtimeMs: Date.now() - 1000 * 60 * 60 * 24 * 10
		}));
		await cleanScratchDirectory();
		expect(removeMock).not.toBeCalled();
	});

	it("doesn't delete an old directory", async () => {
		readdirMock.mockResolvedValue([
			{isDirectory: () => true, name: 'dontdeleteme'}
		]);
		statMock.mockImplementation(() => ({
			mtimeMs: Date.now() - 1001 * 60 * 60 * 24 * 10
		}));
		await cleanScratchDirectory();
		expect(removeMock).not.toBeCalled();
	});
});

describe('openWithScratchFile', () => {
	const mkdirpMock = mkdirp as jest.Mock;
	const openMock = shell.openPath as jest.Mock;
	const writeFileMock = writeFile as jest.Mock;

	it("creates the scratch directory if it doesn't already exist", async () => {
		await openWithScratchFile('mock-data', 'mock-filename');
		expect(mkdirpMock.mock.calls).toEqual([[scratchDirectoryPath()]]);
	});

	it('rejects if creating the scratch directory fails', async () => {
		const error = new Error();

		mkdirpMock.mockRejectedValue(error);
		await expect(() =>
			openWithScratchFile('mock-data', 'mock-filename')
		).rejects.toBe(error);
	});

	it('resolves after writing a file in the scratch directory', async () => {
		await openWithScratchFile('mock-data', 'mock-filename');
		expect(writeFileMock.mock.calls).toEqual([
			[
				'mock-electron-app-path-documents/common.appName/electron.scratchDirectoryName/mock-filename',
				'mock-data',
				'utf8'
			]
		]);
	});

	it('opens the file once written to', async () => {
		await openWithScratchFile('mock-data', 'mock-filename');
		expect(openMock).toBeCalledTimes(1);
		expect(openMock.mock.calls[0]).toEqual([writeFileMock.mock.calls[0][0]]);
	});
});
