'use strict'

const sget = require('simple-get').concat
const Ajv = require('ajv')
const Joi = require('joi')

module.exports.payloadMethod = function (method, t) {
  const test = t.test
  const fastify = require('..')()
  const upMethod = method.toUpperCase()
  const loMethod = method.toLowerCase()

  const opts = {
    schema: {
      body: {
        type: 'object',
        properties: {
          hello: {
            type: 'integer'
          }
        }
      }
    }
  }

  const ajv = new Ajv({ coerceTypes: true, removeAdditional: true })
  const optsWithCustomValidator = {
    schema: {
      body: {
        type: 'object',
        properties: {
          hello: {
            type: 'integer'
          }
        },
        additionalProperties: false
      }
    },
    schemaCompiler: function (schema) {
      return ajv.compile(schema)
    }
  }

  const optsWithJoiValidator = {
    schema: {
      body: Joi.object().keys({
        hello: Joi.string().required()
      }).required()
    },
    schemaCompiler: function (schema) {
      return schema.validate.bind(schema)
    }
  }

  test(`${upMethod} can be created`, t => {
    t.plan(1)
    try {
      fastify[loMethod]('/', opts, function (req, reply) {
        reply.send(req.body)
      })
      fastify[loMethod]('/custom', optsWithCustomValidator, function (req, reply) {
        reply.send(req.body)
      })
      fastify[loMethod]('/joi', optsWithJoiValidator, function (req, reply) {
        reply.send(req.body)
      })

      fastify.register(function (fastify2, opts, next) {
        fastify2.setSchemaCompiler(function schema (schema) {
          return body => ({ error: new Error('From custom schema compiler!') })
        })
        const withInstanceCustomCompiler = {
          schema: {
            body: {
              type: 'object',
              properties: { },
              additionalProperties: false
            }
          }
        }
        fastify2[loMethod]('/plugin', withInstanceCustomCompiler, (req, reply) => reply.send({hello: 'never here!'}))

        const optsWithCustomValidator2 = {
          schema: {
            body: {
              type: 'object',
              properties: { },
              additionalProperties: false
            }
          },
          schemaCompiler: function (schema) {
            return function (body) {
              return { error: new Error('Always fail!') }
            }
          }
        }
        fastify2[loMethod]('/plugin/custom', optsWithCustomValidator2, (req, reply) => reply.send({hello: 'never here!'}))

        next()
      })
      t.pass()
    } catch (e) {
      t.fail()
    }
  })

  fastify.listen(0, function (err) {
    if (err) {
      t.error(err)
    }

    fastify.server.unref()

    test(`${upMethod} - correctly replies`, t => {
      if (upMethod === 'HEAD') {
        t.plan(2)
        sget({
          method: upMethod,
          url: 'http://localhost:' + fastify.server.address().port
        }, (err, response) => {
          t.error(err)
          t.strictEqual(response.statusCode, 200)
        })
      } else {
        t.plan(3)
        sget({
          method: upMethod,
          url: 'http://localhost:' + fastify.server.address().port,
          body: {
            hello: 42
          },
          json: true
        }, (err, response, body) => {
          t.error(err)
          t.strictEqual(response.statusCode, 200)
          t.deepEqual(body, { hello: 42 })
        })
      }
    })

    test(`${upMethod} - 400 on bad parameters`, t => {
      t.plan(3)
      sget({
        method: upMethod,
        url: 'http://localhost:' + fastify.server.address().port,
        body: {
          hello: 'world'
        },
        json: true
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 400)
        t.deepEqual(body, {
          error: 'Bad Request',
          message: JSON.stringify([{
            keyword: 'type',
            dataPath: '.hello',
            schemaPath: '#/properties/hello/type',
            params: { type: 'integer' },
            message: 'should be integer'
          }]),
          statusCode: 400
        })
      })
    })

    test(`${upMethod} - input-validation coerce`, t => {
      t.plan(3)
      sget({
        method: upMethod,
        url: 'http://localhost:' + fastify.server.address().port,
        body: {
          hello: '42'
        },
        json: true
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body, { hello: 42 })
      })
    })

    test(`${upMethod} - input-validation custom schema compiler`, t => {
      t.plan(3)
      sget({
        method: upMethod,
        url: 'http://localhost:' + fastify.server.address().port + '/custom',
        body: {
          hello: '42',
          world: 55
        },
        json: true
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body, { hello: 42 })
      })
    })

    test(`${upMethod} - input-validation joi schema compiler ok`, t => {
      t.plan(3)
      sget({
        method: upMethod,
        url: 'http://localhost:' + fastify.server.address().port + '/joi',
        body: {
          hello: '42'
        },
        json: true
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 200)
        t.deepEqual(body, { hello: 42 })
      })
    })

    test(`${upMethod} - input-validation joi schema compiler ko`, t => {
      t.plan(3)
      sget({
        method: upMethod,
        url: 'http://localhost:' + fastify.server.address().port + '/joi',
        body: {
          hello: 44
        },
        json: true
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 400)
        t.deepEqual(body, {
          error: 'Bad Request',
          message: 'child "hello" fails because ["hello" must be a string]',
          statusCode: 400
        })
      })
    })

    test(`${upMethod} - input-validation instance custom schema compiler encapsulated`, t => {
      t.plan(3)
      sget({
        method: upMethod,
        url: 'http://localhost:' + fastify.server.address().port + '/plugin',
        body: { },
        json: true
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 400)
        t.deepEqual(body, {
          error: 'Bad Request',
          message: 'From custom schema compiler!',
          statusCode: '400'
        })
      })
    })

    test(`${upMethod} - input-validation custom schema compiler encapsulated`, t => {
      t.plan(3)
      sget({
        method: upMethod,
        url: 'http://localhost:' + fastify.server.address().port + '/plugin/custom',
        body: { },
        json: true
      }, (err, response, body) => {
        t.error(err)
        t.strictEqual(response.statusCode, 400)
        t.deepEqual(body, {
          error: 'Bad Request',
          message: 'Always fail!',
          statusCode: '400'
        })
      })
    })
  })
}
