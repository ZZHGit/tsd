///<reference path="../../../_ref.ts" />
///<reference path="../../../../src/git/GithubAPICached.ts" />
///<reference path="../../../../src/git/GitUtil.ts" />
///<reference path="../../../../src/git/GitUtil.ts" />
///<reference path="../../../../src/tsd/context/Context.ts" />
///<reference path="helper.ts" />

declare var gitTest;

describe('git.GithubAPICached', () => {
	'use strict';

	var api:git.GithubAPICached;
	var repo:git.GithubRepo;

	var path = require('path');
	var cacheDir:string;

	beforeEach(() => {
		//use clean tmp folder in this test module
		cacheDir = path.join(gitTest.cacheDir, 'git_api');
		repo = new git.GithubRepo(gitTest.config.repo.owner, gitTest.config.repo.project);
		api = new git.GithubAPICached(repo, cacheDir);
	});
	afterEach(() => {
		repo = null;
		api = null;
	});
	it('pretest', () => {
		assert.isString(gitTest.config.repo.owner, 'owner');
		assert.isString(gitTest.config.repo.project, 'project');
	});

	it('should be defined', () => {
		assert.isFunction(git.GithubAPICached, 'constructor');
	});
	it('should throw on bad params', () => {
		assert.throws(() => {
			api = new git.GithubAPICached(null, null);
		});
	});
	it('should have default options', () => {
		assert.isTrue(api.loader.options.cacheRead, 'options.cacheRead');
		assert.isTrue(api.loader.options.cacheWrite, 'options.cacheWrite');
		assert.isTrue(api.loader.options.remoteRead, 'options.remoteRead');
	});

	describe('mergeParams', () => {
		it('should return user data', () => {
			var params = api.mergeParams({extra: 123});
			assert.propertyVal(params, 'user', gitTest.config.repo.owner);
			assert.propertyVal(params, 'repo', gitTest.config.repo.project);
			assert.propertyVal(params, 'extra', 123, 'additional data');
		});
	});
	describe('getKey', () => {
		it('should return same key for same values', () => {
			var keys = ['aa', 'bb', 'cc'];
			assert.strictEqual(api.loader.getKey('lbl', keys), api.loader.getKey('lbl', keys), 'basic');
		});
	});
	describe('getCachedRaw', () => {
		it('should not return data for bogus key', () => {
			assert.isTrue(api.loader.stats.hasAllZero(), 'pretest stats');

			return api.service.getCachedRaw(api.loader.getKey('bleh blah')).then((data) => {
				assert.notOk(data, 'callback data');

				//xm.log(api.loader.stats.stats.export());
				assert.isTrue(api.loader.stats.hasAllZero(), 'stats');
			});
		});
	});
	describe('getBranches', () => {
		it('should cache and return data from store', () => {
			//api.debug = true;
			assert.isTrue(api.loader.stats.hasAllZero(), 'pretest stats');

			return api.getBranches().then((first) => {
				assert.ok(first, 'first data');
				assert.isArray(first, 'first data');

				//xm.log(api.loader.stats.stats.export());
				helper.assertStatCounter(api.loader.stats, {
					start: 1,
					'read-start': 1,
					'active-set': 1,
					'read-miss': 1,
					'load-start': 1,
					'load-success': 1,
					'write-start': 1,
					'write-success': 1,
					'active-remove': 1,
					complete: 1
				}, 'first');

				// get again, should be cached
				return api.getBranches().then((second) => {
					assert.ok(second, 'second data');
					assert.isArray(second, 'second data');

					//xm.log(api.loader.stats.stats.export());
					helper.assertStatCounter(api.loader.stats, {
						start: 2,
						'read-start': 2,
						'active-set': 2,
						'read-miss': 1,
						'load-start': 1,
						'load-success': 1,
						'write-start': 1,
						'write-success': 1,
						'active-remove': 2,
						complete: 2,
						'read-hit': 1,
						'cache-hit': 1
					}, 'second');

					//kill
					delete first.meta;
					delete second.meta;

					//same data?
					assert.deepEqual(first, second, 'first vs second');
				});
			});
		});
	});
	describe('getBlob', () => {
		it('should cache and return data from store', () => {
			//api.debug = true;
			assert.isTrue(api.loader.stats.hasAllZero(), 'pretest stats');

			var expectedJson = xm.FileUtil.readJSONSync(path.join(gitTest.fixtureDir, 'blobResult.json'));
			var expectedSha = expectedJson.sha;
			helper.isStringSHA1(expectedSha, 'fixSha');

			return api.getBlob(expectedSha).then((first) => {
				assert.ok(first, 'callback data');
				assert.isObject(first, 'data');

				//xm.log(api.loader.stats.stats.export());
				helper.assertStatCounter(api.loader.stats, {
					start: 1,
					'read-start': 1,
					'active-set': 1,
					'read-miss': 1,
					'load-start': 1,
					'load-success': 1,
					'write-start': 1,
					'write-success': 1,
					'active-remove': 1,
					complete: 1
				}, 'first');

				assert.strictEqual(first.sha, expectedSha, 'first.sha vs expectedSha');

				first.meta['x-ratelimit-remaining'] = expectedJson.meta['x-ratelimit-remaining'];
				assert.deepEqual(first, expectedJson, 'first vs expectedJson');

				var firstBuffer = git.GitUtil.decodeBlob(first);
				assert.instanceOf(firstBuffer, Buffer, 'buffer');
				var firstSha = git.GitUtil.blobSHAHex(firstBuffer);
				assert.strictEqual(firstSha, expectedSha, 'firstSha vs expected');

				// get again, should be cached
				return api.getBlob(expectedSha).then((second) => {
					assert.ok(second, 'second callback data');
					assert.isObject(second, 'data');

					//xm.log(api.loader.stats.stats.export());
					helper.assertStatCounter(api.loader.stats, {
						start: 2,
						'read-start': 2,
						'active-set': 2,
						'read-miss': 1,
						'load-start': 1,
						'load-success': 1,
						'write-start': 1,
						'write-success': 1,
						'active-remove': 2,
						complete: 2,
						'read-hit': 1,
						'cache-hit': 1
					}, 'second');

					assert.strictEqual(second.sha, expectedSha, 'second.sha vs expectedSha');

					second.meta['x-ratelimit-remaining'] = first.meta['x-ratelimit-remaining'];
					assert.deepEqual(first, second, 'first vs second');

					var secondBuffer = git.GitUtil.decodeBlob(first);
					assert.instanceOf(secondBuffer, Buffer, 'buffer');
					var secondSha = git.GitUtil.blobSHAHex(secondBuffer);
					assert.strictEqual(secondSha, expectedSha, 'secondSha vs expected');
				});
			});
		});
	});
});